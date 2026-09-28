'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startFakeYtDevice } = require('./fake-yt-device');
const { Store } = require('../src/store');
const { AgentRuntime } = require('../src/runtime');
const { MainApiError } = require('../src/mainapi-client');

const { istanbulDay } = require('../src/time');

const silent = { info() {}, warn() {}, error() {} };
const istanbulToday = () => istanbulDay();

/** Bellek içi MainApi taklidi: sözleşmedeki kiralama / ack / olay kurallarını uygular. */
function fakeMainApi(devices) {
  const api = {
    devices,
    items: new Map(),
    logs: new Map(),
    acks: [],
    online: true,
    revoked: false,
    heartbeats: [],
    guard() {
      if (api.revoked) throw new MainApiError(401, 'UNAUTHORIZED', 'revoked');
      if (!api.online) throw new TypeError('fetch failed');
    },
    async getWork() {
      api.guard();
      const now = Date.now();
      const out = [];
      for (const item of api.items.values()) {
        if (item.status === 'pending' || (item.status === 'delivered' && item.leaseUntil < now)) {
          item.status = 'delivered';
          item.leaseUntil = now + 60_000;
          out.push({ ...item });
        }
      }
      return { devices: api.devices, items: out };
    },
    async ack(id, body) {
      api.guard();
      api.acks.push({ id, ...body });
      const item = api.items.get(id);
      if (body.version < item.version) return { status: 'superseded' };
      item.status = body.result;
      item.leaseUntil = null;
      return { status: item.status };
    },
    async sendEvents(events) {
      api.guard();
      let accepted = 0;
      for (const e of events) {
        const key = `${e.gateId}_${e.eventId}`;
        if (!api.logs.has(key)) {
          api.logs.set(key, e);
          accepted += 1;
        }
      }
      return { accepted, duplicates: events.length - accepted, rejected: [] };
    },
    async heartbeat(body) {
      api.guard();
      api.heartbeats.push(body);
    },
  };
  return api;
}

async function setup(t) {
  const dev = await startFakeYtDevice();
  const store = new Store(':memory:');
  t.after(async () => {
    store.close();
    await dev.close();
  });
  const device = {
    gateId: 'g1',
    name: 'Turnike 1',
    protocol: 'yt-http-digest',
    host: dev.host,
    port: dev.port,
    direction: 'in',
    capabilities: { events: true, userSync: true, doorOpen: false },
  };
  const api = fakeMainApi([device]);
  const runtime = new AgentRuntime({
    client: api,
    store,
    credentials: { [dev.host]: { username: 'admin', password: 'secret' } },
    agentVersion: 'test',
    logger: silent,
  });
  return { dev, store, api, runtime };
}

test('iş öğesini cihaza uygular ve doğrulanmış onay gönderir', async (t) => {
  const { dev, api, runtime } = await setup(t);
  api.items.set('g1_m1', { id: 'g1_m1', gateId: 'g1', userId: '1042', name: 'Ali', card: '55', validEnd: '20261031', enabled: true, version: 3, status: 'pending' });
  await runtime.tick();
  assert.equal(dev.state.users.get('1042').vaildEnd, '20261031');
  assert.deepEqual(api.acks, [{ id: 'g1_m1', version: 3, result: 'applied', verified: true }]);
});

test('cihaz tarihi uygulamazsa hata olarak bildirilir', async (t) => {
  const { dev, api, runtime } = await setup(t);
  dev.state.ignoreVaildEnd = true;
  api.items.set('g1_m1', { id: 'g1_m1', gateId: 'g1', userId: '1', name: 'A', card: null, validEnd: '20261031', enabled: true, version: 1, status: 'pending' });
  await runtime.tick();
  assert.equal(api.acks[0].result, 'error');
  assert.equal(api.acks[0].verified, false);
});

test('cihaza ulaşılamazsa onay gönderilmez (kiralama dolunca tekrar gelir)', async (t) => {
  const { dev, api, runtime } = await setup(t);
  dev.state.down = true;
  api.items.set('g1_m1', { id: 'g1_m1', gateId: 'g1', userId: '1', name: 'A', validEnd: '20261031', enabled: true, version: 1, status: 'pending' });
  await runtime.tick();
  assert.deepEqual(api.acks, []);
  assert.equal(api.items.get('g1_m1').status, 'delivered');

  await runtime.heartbeat();
  assert.equal(api.heartbeats[0].devices[0].reachable, false);
  assert.ok(api.heartbeats[0].devices[0].lastError);
});

test('internet yokken olaylar yerel kuyrukta bekler, gelince bir kez gönderilir', async (t) => {
  const { dev, store, api, runtime } = await setup(t);
  await runtime.tick(); // cihaz listesini öğren
  dev.addLogs(30, istanbulToday());
  api.online = false;
  await runtime.tick();
  await runtime.tick();
  assert.equal(store.queueDepth(), 30);
  assert.equal(api.logs.size, 0);

  api.online = true;
  await runtime.tick();
  assert.equal(store.queueDepth(), 0);
  assert.equal(api.logs.size, 30);

  // Aynı kayıtlar yeniden okunsa da tekrar gönderilmez.
  await runtime.tick();
  assert.equal(api.logs.size, 30);
  const first = [...api.logs.values()][0];
  assert.equal(first.userId, '1000');
  assert.equal(first.result, null);
});

test('agent iptal edilince çalışmayı durdurur', async (t) => {
  const { api, runtime } = await setup(t);
  api.revoked = true;
  await runtime.tick();
  assert.equal(runtime.revoked, true);
});

test('heartbeat cihaz erişilebilirliğini ve kuyruk derinliğini bildirir', async (t) => {
  const { api, runtime } = await setup(t);
  await runtime.tick();
  await runtime.heartbeat();
  assert.deepEqual(
    { gateId: api.heartbeats[0].devices[0].gateId, reachable: api.heartbeats[0].devices[0].reachable, queueDepth: api.heartbeats[0].queueDepth },
    { gateId: 'g1', reachable: true, queueDepth: 0 },
  );
});
