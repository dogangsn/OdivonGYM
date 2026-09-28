'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startFakeYtDevice } = require('./fake-yt-device');
const { createYtHttpDigestAdapter, deviceName } = require('../src/adapters/yt-http-digest');

async function setup(t, opts) {
  const dev = await startFakeYtDevice(opts);
  t.after(() => dev.close());
  const adapter = createYtHttpDigestAdapter(
    { gateId: 'g1', protocol: 'yt-http-digest', host: dev.host, port: dev.port, direction: 'in' },
    { username: 'admin', password: 'secret' },
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

test('tüm log sayfalarını okur, imleçten devam eder', async (t) => {
  const { dev, adapter } = await setup(t);
  dev.addLogs(250);
  const first = await adapter.readEvents(null);
  assert.equal(first.events.length, 250);
  assert.deepEqual(first.cursor, { total: 250, page: 3 });
  assert.equal(first.events[0].eventId, 'yt-1');
  assert.equal(first.events[0].time, '2026-09-28T21:14:05+03:00');
  assert.equal(first.events[0].result, null, 'cihaz sonucu bildirmiyorsa tahmin edilmez');

  dev.addLogs(60);
  const next = await adapter.readEvents(first.cursor);
  // Son sayfa (201-300) ve yeni sayfa (301-310) okunur; tekrarlar store'da ayıklanır.
  assert.deepEqual(next.cursor, { total: 310, page: 4 });
  assert.ok(next.events.some((e) => e.eventId === 'yt-310'));
  assert.ok(!next.events.some((e) => e.eventId === 'yt-150'));
});

test('cihaz logu temizlenirse baştan okur', async (t) => {
  const { dev, adapter } = await setup(t);
  dev.addLogs(5);
  const res = await adapter.readEvents({ total: 400, page: 4 });
  assert.equal(res.events.length, 5);
  assert.deepEqual(res.cursor, { total: 5, page: 1 });
});

test('yetki verir ve geri okuyarak doğrular', async (t) => {
  const { dev, adapter } = await setup(t);
  const item = { userId: '1042', name: 'Ayşe Yılmaz', card: '0012345', validEnd: '20261031', enabled: true };
  assert.deepEqual(await adapter.applyUser(item), { verified: true });
  assert.deepEqual(dev.state.users.get('1042'), { userId: '1042', name: 'Ayse Yilmaz', card: '0012345', vaildEnd: '20261031' });
  // Tekrar uygulamak idempotent.
  assert.deepEqual(await adapter.applyUser(item), { verified: true });
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

test('cihaz adı ASCII ve kısa', () => {
  assert.equal(deviceName('Çağrı Şükrü Öğüt İnce'), 'Cagri Sukru Ogut Ince');
  assert.equal(deviceName('x'.repeat(40)).length, 24);
});
