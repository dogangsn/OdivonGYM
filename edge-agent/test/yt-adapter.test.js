'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startFakeYtDevice } = require('./fake-yt-device');
const { createYtHttpDigestAdapter, deviceName } = require('../src/adapters/yt-http-digest');

const NOW = new Date('2026-09-28T18:30:00Z'); // 21:30 TR

async function setup(t, { now = () => NOW } = {}) {
  const dev = await startFakeYtDevice();
  t.after(() => dev.close());
  const adapter = createYtHttpDigestAdapter(
    { gateId: 'g1', protocol: 'yt-http-digest', host: dev.host, port: dev.port, direction: 'in' },
    { username: 'admin', password: 'secret' },
    { now },
  );
  return { dev, adapter };
}

test('yanlış parola digest hatası verir', async (t) => {
  const dev = await startFakeYtDevice();
  t.after(() => dev.close());
  const adapter = createYtHttpDigestAdapter(
    { gateId: 'g1', protocol: 'yt-http-digest', host: dev.host, port: dev.port },
    { username: 'admin', password: 'yanlis' },
  );
  await assert.rejects(adapter.ping(), /Digest/);
});

test('ilk çalıştırmada tüm geçmişi okur, sonra dünden başlayan pencereye geçer', async (t) => {
  const { dev, adapter } = await setup(t);
  dev.addLogs(700, '20260101');
  dev.addLogs(600, '20260928');
  const first = await adapter.readEvents(null);
  assert.equal(first.events.length, 1300);
  assert.equal(new Set(first.events.map((e) => e.eventId)).size, 1300, 'olay kimlikleri benzersiz');
  assert.deepEqual(first.cursor, { beginDay: '20260927', page: 0, total: 0 });
  const e = first.events[700];
  assert.equal(e.time, '2026-09-28T08:11:40+03:00');
  assert.equal(e.direction, 'in');
  assert.equal(e.result, null, 'cihaz sonucu bildirmediği için tahmin edilmez');
  assert.equal(first.events[701].direction, 'out');

  // Pencere dünden itibaren: yalnızca bugünün 600 kaydı + yeni 10 kayıt okunur.
  dev.addLogs(10, '20260928');
  const next = await adapter.readEvents(first.cursor);
  assert.equal(next.events.length, 610);
  assert.deepEqual(next.cursor, { beginDay: '20260927', page: 20, total: 610 });

  // Sonraki turda son sayfadan (30'luk sayfalar) devam eder.
  dev.addLogs(5, '20260928');
  const third = await adapter.readEvents(next.cursor);
  assert.equal(third.events.length, 15);
  assert.deepEqual(third.cursor, { beginDay: '20260927', page: 20, total: 615 });
});

test('gün değişince pencere yeni düne kayar', async (t) => {
  const { adapter, dev } = await setup(t, { now: () => new Date('2026-09-30T08:00:00Z') });
  dev.addLogs(3, '20260930');
  const res = await adapter.readEvents({ beginDay: '20260927', page: 4, total: 2400 });
  assert.equal(res.events.length, 3);
  assert.deepEqual(res.cursor, { beginDay: '20260929', page: 0, total: 3 });
});

test('cihaz logu temizlenirse baştan okur', async (t) => {
  const { dev, adapter } = await setup(t);
  dev.addLogs(5, '20260928');
  const res = await adapter.readEvents({ beginDay: '20260927', page: 3, total: 2000 });
  assert.equal(res.events.length, 5);
  assert.deepEqual(res.cursor, { beginDay: '20260927', page: 0, total: 5 });
});

test('yetki verir ve geri okuyarak doğrular', async (t) => {
  const { dev, adapter } = await setup(t);
  const item = { userId: '1042', name: 'Ayşe Yılmaz', card: '0012345', validEnd: '20261031', enabled: true };
  assert.deepEqual(await adapter.applyUser(item), { verified: true });
  assert.deepEqual(dev.state.users.get('1042'), {
    privilege: 0,
    vaildStart: '20000101',
    userId: '1042',
    name: 'Ayse Yilm',
    card: '0012345',
    vaildEnd: '20261031',
  });
  assert.deepEqual(dev.state.requests.at(-2), {
    cmd: 'SetUserInfo',
    data: {
      users: [{ vaildStart: '20000101', userId: '1042', name: 'Ayse Yilm', card: '0012345', vaildEnd: '20261031', update: 1 }],
    },
  });
  // Tekrar uygulamak idempotent.
  assert.deepEqual(await adapter.applyUser(item), { verified: true });
});

test('cihaz geçici -2 (meşgul) dönerse tekrar dener', async (t) => {
  const { dev, adapter } = await setup(t);
  dev.state.busyOnce = true;
  assert.deepEqual(await adapter.applyUser({ userId: '8', name: 'Z', card: null, validEnd: '20261031', enabled: true }), {
    verified: true,
  });
});

test('cihaz bitiş tarihini uygulamazsa doğrulanmış sayılmaz', async (t) => {
  const { dev, adapter } = await setup(t);
  dev.state.ignoreVaildEnd = true;
  const res = await adapter.applyUser({ userId: '7', name: 'X', card: null, validEnd: '20261031', enabled: true });
  assert.deepEqual(res, { verified: false });
});

test('yetki kapatma kullanıcıyı siler, yoksa da doğrulanır', async (t) => {
  const { dev, adapter } = await setup(t);
  dev.state.users.set('9', { userId: '9', name: 'Y', card: '1', vaildEnd: '20261231' });
  assert.deepEqual(await adapter.applyUser({ userId: '9', enabled: false }), { verified: true });
  assert.equal(dev.state.users.has('9'), false);
  assert.deepEqual(await adapter.applyUser({ userId: '9', enabled: false }), { verified: true });
});

test('erişilemeyen cihaz geçici hata verir', async (t) => {
  const { dev, adapter } = await setup(t);
  dev.state.down = true;
  await assert.rejects(adapter.applyUser({ userId: '1', enabled: true, validEnd: '20261231' }), (err) => err.transient === true);
});

test('üye numarası değişince eski cihaz kullanıcısı silinir', async (t) => {
  const { dev, adapter } = await setup(t);
  dev.state.users.set('500', { userId: '500', name: 'A', card: '1', vaildEnd: '20261231' });
  const res = await adapter.applyUser({ userId: '501', replacesUserId: '500', name: 'A', card: '1', validEnd: '20261231', enabled: true });
  assert.deepEqual(res, { verified: true });
  assert.equal(dev.state.users.has('500'), false);
  assert.equal(dev.state.users.get('501').vaildEnd, '20261231');
});

test('cihaz adı ASCII ve en çok 9 karakter', () => {
  assert.equal(deviceName('Çağrı Şükrü Öğüt İnce'), 'Cagri Suk');
  assert.equal(deviceName('x'.repeat(40)).length, 9);
});
