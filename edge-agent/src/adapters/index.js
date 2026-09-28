'use strict';

/**
 * Protokol → adapter kaydı. Her adapter aynı sözleşmeyi uygular:
 *
 *   ping()                      → { deviceTime?: string }   (cihaza erişilebiliyor mu)
 *   readEvents(cursor)          → { events: AgentEvent[], cursor }
 *   applyUser(item)             → { verified: true } ya da DeviceError fırlatır
 *   close()
 *
 * AgentEvent: { eventId, userId, card, time (ISO, +03:00), direction, result, verifyMode, raw }
 */

const { createYtHttpDigestAdapter } = require('./yt-http-digest');
const { createUnsupportedAdapter } = require('./unsupported');

const FACTORIES = {
  'yt-http-digest': createYtHttpDigestAdapter,
  'zk-tcp-4370': (device) => createUnsupportedAdapter(device, 'ZK TCP/4370 adapteri henüz gerçek cihazla doğrulanmadı.'),
  'vendor-sdk': (device) => createUnsupportedAdapter(device, 'Üretici SDK adapteri henüz eklenmedi.'),
};

function createAdapter(device, credentials) {
  const factory = FACTORIES[device.protocol];
  if (!factory) return createUnsupportedAdapter(device, `Bilinmeyen protokol: ${device.protocol}`);
  return factory(device, credentials);
}

module.exports = { createAdapter, SUPPORTED_PROTOCOLS: Object.keys(FACTORIES) };
