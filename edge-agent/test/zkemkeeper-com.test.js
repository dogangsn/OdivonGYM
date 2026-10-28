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
