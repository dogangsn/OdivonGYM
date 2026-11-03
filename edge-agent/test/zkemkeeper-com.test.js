'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bridgeMessageToEvent, directionFromAttState } = require('../src/adapters/zkemkeeper-com');

test('zkemkeeper OnAttTransactionEx alanlarını eksiksiz Agent olayına çevirir', () => {
  const event = bridgeMessageToEvent(
    { host: '192.168.1.202', direction: 'in' },
    {
      type: 'event',
      source: 'realtime',
      enrollNumber: '117673',
      card: '99887766',
      deviceUserName: 'Test Üye',
      isInvalid: 0,
      attState: 1,
      verifyMethod: 2,
      timestamp: '2026-10-28T17:21:47',
      workCode: 34,
    },
  );

  assert.match(event.eventId, /^zk-[a-f0-9]{32}$/);
  assert.deepEqual(event, {
    eventId: event.eventId,
    userId: '117673',
    card: '99887766',
    time: '2026-10-28T17:21:47+03:00',
    direction: 'out',
    result: 'granted',
    verifyMode: '2',
    raw: {
      driver: 'zkemkeeper-com',
      source: 'realtime',
      enrollNumber: '117673',
      deviceUserName: 'Test Üye',
      isInvalid: 0,
      attState: 1,
      verifyMethod: 2,
      workCode: 34,
    },
  });
});

test('geçmiş SDK kaydında sonuç yoksa tahmin etmez', () => {
  const event = bridgeMessageToEvent(
    { host: '192.168.1.202', direction: 'in' },
    {
      source: 'history',
      enrollNumber: '117673',
      isInvalid: null,
      attState: 0,
      verifyMethod: 1,
      timestamp: '2026-10-28T08:14:10',
      workCode: 0,
    },
  );
  assert.equal(event.result, null);
  assert.equal(event.direction, 'in');
  assert.equal(event.verifyMode, '1');
});

test('SDK giriş çıkış durumlarını yönlere eşler', () => {
  assert.equal(directionFromAttState(0, 'out'), 'in');
  assert.equal(directionFromAttState(1, 'in'), 'out');
  assert.equal(directionFromAttState(2, 'in'), 'out');
  assert.equal(directionFromAttState(3, 'out'), 'in');
  assert.equal(directionFromAttState(null, 'out'), 'out');
});

test('köprü geçmiş ve kullanıcı okumayı yalnızca ayar açıksa atlar', () => {
  const { bridgeArgs } = require('../src/adapters/zkemkeeper-com');
  const device = { host: '192.168.1.202', port: 4370 };
  assert.deepEqual(bridgeArgs(device, {}), ['--host', '192.168.1.202', '--port', '4370', '--machine', '1']);
  assert.deepEqual(bridgeArgs(device, { machineNumber: 2, skipHistory: true, skipUsers: true }), [
    '--host', '192.168.1.202', '--port', '4370', '--machine', '2', '--skip-history', '--skip-users',
  ]);
});

test('cihaz saati yanlışsa canlı olayda bilgisayar saati kullanılır', () => {
  const message = { type: 'event', source: 'realtime', enrollNumber: '14441', card: '9855037', attState: 0, timestamp: '2000-10-01T17:16:53' };
  const now = () => new Date('2026-11-02T20:01:50Z');
  const fixed = bridgeMessageToEvent({ host: '192.168.1.202' }, message, { useAgentClock: true, now });
  assert.equal(fixed.time, '2026-11-02T20:01:50.000Z');
  assert.equal(fixed.raw.deviceTimestamp, '2000-10-01T17:16:53');
  const history = bridgeMessageToEvent({ host: '192.168.1.202' }, { ...message, source: 'history' }, { useAgentClock: true, now });
  assert.equal(history.time, '2000-10-01T17:16:53+03:00');
  const off = bridgeMessageToEvent({ host: '192.168.1.202' }, message, { now });
  assert.equal(off.time, '2000-10-01T17:16:53+03:00');
});

const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createZkemkeeperComAdapter } = require('../src/adapters/zkemkeeper-com');

/** Köprü sürecinin taklidi: stdin'e gelen komutları bellekteki kullanıcılarla cevaplar. */
function fakeBridge(users = new Map()) {
  const spawned = [];
  const spawnImpl = (file, args) => {
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => child.emit('exit', null);
    const out = (msg) => child.stdout.write(`${JSON.stringify(msg)}\n`);
    let buffer = '';
    child.stdin.on('data', (chunk) => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const cmd = JSON.parse(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        const u = users.get(cmd.enrollNumber);
        let data;
        if (cmd.cmd === 'getUser') data = { found: Boolean(u), user: u ?? null };
        else if (cmd.cmd === 'setUser') {
          const next = { enrollNumber: cmd.enrollNumber, name: cmd.name, card: cmd.card ?? u?.card ?? null, enabled: cmd.enabled, privilege: 0 };
          users.set(cmd.enrollNumber, next);
          data = { user: next };
        } else if (cmd.cmd === 'enableUser') {
          u.enabled = cmd.enabled;
          data = { user: u };
        } else if (cmd.cmd === 'deleteUser') {
          users.delete(cmd.enrollNumber);
          data = { deleted: true };
        } else if (cmd.cmd === 'listUsers') data = { users: [...users.values()] };
        out({ type: 'result', id: cmd.id, ok: true, data });
      }
    });
    spawned.push({ file, args, child });
    setImmediate(() => out({ type: 'ready', commands: true }));
    return child;
  };
  return { spawnImpl, spawned, users };
}

test('ZK köprüsü üyeyi yazar, geri okur; yetki kapatma silmez, pasif yapar', async () => {
  const users = new Map([['14441', { enrollNumber: '14441', name: 'ESKI', card: '9855037', enabled: true, privilege: 0 }]]);
  const bridge = fakeBridge(users);
  const adapter = createZkemkeeperComAdapter({ host: '192.168.1.202', port: 4370 }, {}, { spawnImpl: bridge.spawnImpl });
  assert.equal(adapter.localExpiry, true);

  // Kart verilmezse cihazdaki kart korunur
  assert.deepEqual(await adapter.applyUser({ userId: '14441', name: 'Şule Öztürk', enabled: true }), { verified: true });
  assert.equal(users.get('14441').name, 'Sule Ozturk');
  assert.equal(users.get('14441').card, '9855037');

  assert.deepEqual(await adapter.applyUser({ userId: '14441', enabled: false }), { verified: true });
  assert.equal(users.get('14441').enabled, false);
  assert.ok(users.has('14441'), 'pasif yapılan üye silinmemeli');

  // Cihazda olmayan üyeyi kapatmak bir şey yazmaz
  assert.deepEqual(await adapter.applyUser({ userId: '777', enabled: false }), { verified: true });
  assert.ok(!users.has('777'));

  assert.deepEqual(await adapter.applyUser({ userId: '555', name: 'Yeni', card: '00123', enabled: true }), { verified: true });
  assert.deepEqual(await adapter.deleteUser('555'), { verified: true });
  assert.equal(bridge.spawned.length, 1, 'tek köprü süreci kullanılmalı');
  adapter.close();
});

test('köprü kapanınca bekleyen komut geçici hatayla biter', async () => {
  const bridge = fakeBridge();
  const adapter = createZkemkeeperComAdapter({ host: '192.168.1.202' }, {}, { spawnImpl: bridge.spawnImpl });
  await adapter.ping();
  const child = bridge.spawned[0].child;
  child.stdin.removeAllListeners('data'); // cevap vermesin
  const pending = adapter.getUser('1');
  await new Promise((r) => setImmediate(r));
  child.emit('exit', 5);
  await assert.rejects(pending, (err) => err.transient === true);
});
