'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createZkTcpAdapter, normalizeTime, resolveDirection } = require('../src/adapters/zk-tcp-4370');
const { asDeviceError } = require('../src/adapters/errors');

function setupDriver() {
  const state = { connected: 0, disconnected: 0, realtime: null };
  const driver = {
    async createSocket() {
      state.connected += 1;
    },
    async getAttendances() {
      return {
        data: [
          {
            sn: 7,
            user_id: '1042',
            record_time: '2026-10-28 08:14:10',
            type: 4,
            state: 0,
          },
        ],
      };
    },
    async getUsers() {
      return { data: [] };
    },
    async getTime() {
      return new Date('2026-10-28T05:15:00.000Z');
    },
    async getRealTimeLogs(callback) {
      state.realtime = callback;
    },
    async disconnect() {
      state.disconnected += 1;
    },
  };
  return { state, driver, factory: () => driver };
}

test('ilk bağlantıda geçmiş hareketleri okur ve gerçek zamanlı olayları kuyruğa alır', async () => {
  const { state, factory } = setupDriver();
  const adapter = createZkTcpAdapter(
    { gateId: 'g1', protocol: 'zk-tcp-4370', host: '192.168.1.10', port: 4370, direction: 'in' },
    {},
    { driverFactory: factory },
  );

  const first = await adapter.readEvents(null);
  assert.equal(state.connected, 1);
  assert.equal(first.events.length, 1);
  assert.match(first.events[0].eventId, /^zk-[a-f0-9]{32}$/);
  assert.deepEqual(first.events[0], {
    eventId: first.events[0].eventId,
    userId: '1042',
    card: null,
    time: '2026-10-28T08:14:10+03:00',
    direction: 'in',
    result: null,
    verifyMode: '4',
    raw: {
      sn: 7,
      deviceUid: '1042',
      enrollNumber: '1042',
      deviceUserName: null,
      state: 0,
      type: 4,
    },
  });
  assert.equal(first.deviceTime, '2026-10-28T05:15:00.000Z');

  state.realtime({ userId: '1042', attTime: new Date('2026-10-28T06:00:00.000Z') });
  const second = await adapter.readEvents(first.cursor);
  assert.equal(second.events.length, 1);
  assert.equal(second.events[0].time, '2026-10-28T06:00:00.000Z');
  assert.equal(second.events[0].userId, '1042');

  const third = await adapter.readEvents(second.cursor);
  assert.deepEqual(third.events, []);
  adapter.close();
});

test('aynı ham kayıt aynı deterministik olay kimliğini üretir', async () => {
  const one = setupDriver();
  const two = setupDriver();
  const config = { gateId: 'g1', protocol: 'zk-tcp-4370', host: '192.168.1.10', port: 4370, direction: 'out' };
  const first = await createZkTcpAdapter(config, {}, { driverFactory: one.factory }).readEvents(null);
  const second = await createZkTcpAdapter(config, {}, { driverFactory: two.factory }).readEvents(null);
  assert.equal(first.events[0].eventId, second.events[0].eventId);
  assert.equal(first.events[0].direction, 'out');
});

test('state-yön eşlemesi kapı yönünden önce uygulanır', () => {
  assert.equal(resolveDirection('in', { 1: 'out' }, 1), 'out');
  assert.equal(resolveDirection('out', null, 0), 'out');
  assert.equal(resolveDirection('both', null, 0), null);
});

test('cihaz tarih biçimlerini normalize eder', () => {
  assert.equal(normalizeTime('20261028113243'), '2026-10-28T11:32:43+03:00');
  assert.equal(normalizeTime(new Date('2026-10-28T08:32:43Z')), '2026-10-28T08:32:43.000Z');
  assert.equal(normalizeTime('bozuk'), null);
});

test('CommKey etkinse sessizce başarısız olmak yerine açık hata verir', async () => {
  const { factory } = setupDriver();
  const adapter = createZkTcpAdapter(
    { gateId: 'g1', protocol: 'zk-tcp-4370', host: '192.168.1.10', port: 4370 },
    { commKey: 1234 },
    { driverFactory: factory },
  );
  await assert.rejects(adapter.readEvents(null), /CommKey/);
});

test('ZK cihazına kullanıcı yazma güvenli doğrulama olmadan açılmaz', async () => {
  const { factory } = setupDriver();
  const adapter = createZkTcpAdapter(
    { gateId: 'g1', protocol: 'zk-tcp-4370', host: '192.168.1.10', port: 4370 },
    {},
    { driverFactory: factory },
  );
  await assert.rejects(adapter.applyUser({ userId: '1' }), /kullanıcı senkronu/);
});

test('zkteco-js iç içe ağ hataları geçici cihaz hatasına çevrilir', () => {
  const error = asDeviceError({ err: { err: Object.assign(new Error('connect failed'), { code: 'ECONNREFUSED' }) } });
  assert.equal(error.message, 'connect failed');
  assert.equal(error.transient, true);
});

test('TCP 4370 reddedilirse cihazın UDP 4370 kanalına geçer', async () => {
  const { driver, factory } = setupDriver();
  const state = { udpSocketCreated: 0, udpConnected: 0 };
  driver.createSocket = async () => {
    throw { err: { err: Object.assign(new Error('TCP refused'), { code: 'ECONNREFUSED' }) } };
  };
  driver.zudp = {
    socket: null,
    async createSocket() {
      state.udpSocketCreated += 1;
      this.socket = {};
    },
    async connect() {
      state.udpConnected += 1;
    },
  };

  const adapter = createZkTcpAdapter(
    { gateId: 'g1', protocol: 'zk-tcp-4370', host: '192.168.1.10', port: 4370, direction: 'in' },
    { udpInPort: 4000 },
    { driverFactory: factory },
  );
  const result = await adapter.readEvents(null);

  assert.equal(state.udpSocketCreated, 1);
  assert.equal(state.udpConnected, 1);
  assert.equal(driver.connectionType, 'udp');
  assert.equal(result.events.length, 1);
  adapter.close();
});

test('başarısız UDP bağlantısından sonra yerel soketi serbest bırakır', async () => {
  const { driver, factory } = setupDriver();
  let udpClosed = 0;
  driver.createSocket = async () => {
    throw { err: Object.assign(new Error('TCP refused'), { code: 'ECONNREFUSED' }) };
  };
  driver.disconnect = async () => {
    throw new Error('connection type yok');
  };
  driver.zudp = {
    socket: null,
    async createSocket() {
      this.socket = {};
    },
    async connect() {
      throw Object.assign(new Error('UDP timeout'), { code: 'ETIMEDOUT' });
    },
    async closeSocket() {
      udpClosed += 1;
      this.socket = null;
    },
  };

  const adapter = createZkTcpAdapter(
    { gateId: 'g1', protocol: 'zk-tcp-4370', host: '192.168.1.10', port: 4370, direction: 'in' },
    { udpInPort: 4000 },
    { driverFactory: factory },
  );

  await assert.rejects(adapter.readEvents(null), /UDP timeout/);
  assert.equal(udpClosed, 1);
});

test('canlı abonelikten önce eski UDP mesaj dinleyicilerini temizler', async () => {
  const { state, driver, factory } = setupDriver();
  const socket = new EventEmitter();
  socket.on('message', () => undefined);
  driver.connectionType = 'udp';
  driver.zudp = { socket };
  driver.getRealTimeLogs = async (callback) => {
    assert.equal(socket.listenerCount('message'), 0);
    state.realtime = callback;
  };

  const adapter = createZkTcpAdapter(
    { gateId: 'g1', protocol: 'zk-tcp-4370', host: '192.168.1.10', port: 4370, direction: 'in' },
    {},
    { driverFactory: factory },
  );

  await adapter.readEvents(null);
  assert.equal(typeof state.realtime, 'function');
  adapter.close();
});

test('eski UDP cihazının iç UID değerini gerçek EnrollNumber ve kartla eşler', async () => {
  const { state, driver, factory } = setupDriver();
  driver.connectionType = 'udp';
  driver.getUsers = async () => ({
    data: [{ uid: 7, userId: 117673, name: 'Test Üye', cardno: 998877 }],
  });
  driver.getAttendances = async () => ({
    data: [{ user_id: 7, record_time: '2026-10-28 08:14:10' }],
  });

  const adapter = createZkTcpAdapter(
    { gateId: 'g1', protocol: 'zk-tcp-4370', host: '192.168.1.10', port: 4370, direction: 'in' },
    {},
    { driverFactory: factory },
  );

  const history = await adapter.readEvents(null);
  assert.equal(history.events[0].userId, '117673');
  assert.equal(history.events[0].card, '998877');
  assert.equal(history.events[0].raw.deviceUid, '7');
  assert.equal(history.events[0].raw.deviceUserName, 'Test Üye');

  state.realtime({ userId: 7, attTime: new Date('2026-10-28T08:15:00Z') });
  const realtime = await adapter.readEvents(history.cursor);
  assert.equal(realtime.events[0].userId, '117673');
  assert.equal(realtime.events[0].card, '998877');
  adapter.close();
});
