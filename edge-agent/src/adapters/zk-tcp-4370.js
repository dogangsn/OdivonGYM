'use strict';

/**
 * ZKTeco standalone TCP/4370 adapteri.
 *
 * Bu adapter cihazı yalnızca okur: ilk bağlantıda cihazdaki mevcut hareketleri
 * indirir, ardından gerçek zamanlı olay aboneliğini açık tutar. MainApi tarafında
 * `userSync` kapalıdır; üyeye/karta ait hiçbir veri cihaza yazılmaz.
 */

const crypto = require('node:crypto');
const Zkteco = require('zkteco-js');
const { DeviceError, asDeviceError } = require('./errors');
const { toIstanbulIso } = require('../time');

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_UDP_IN_PORT = 4_000;
const DEFAULT_MAX_CHUNK_BYTES = 65_472;

function defaultDriverFactory({ host, port, timeoutMs, udpInPort, maxChunkBytes }) {
  return new Zkteco(host, port, timeoutMs, udpInPort, maxChunkBytes);
}

function createZkTcpAdapter(device, credentials = {}, { driverFactory = defaultDriverFactory } = {}) {
  const commKey = Number(credentials.commKey ?? 0);
  const timeoutMs = positiveInt(credentials.timeoutMs, DEFAULT_TIMEOUT_MS);
  const udpInPort = positiveInt(credentials.udpInPort, DEFAULT_UDP_IN_PORT);
  const maxChunkBytes = positiveInt(credentials.maxChunkBytes, DEFAULT_MAX_CHUNK_BYTES);

  let driver = null;
  let connected = false;
  let connecting = null;
  let subscribed = false;
  let pending = [];
  let deviceTime = null;

  function ensureSupportedConfig() {
    if (commKey !== 0) {
      throw new DeviceError(
        'ZK TCP adaptörü CommKey doğrulamasını desteklemiyor. Cihaz CommKey değerini 0 yapın veya vendor-sdk köprüsünü kullanın.',
      );
    }
  }

  function markDisconnected() {
    connected = false;
    subscribed = false;
  }

  async function disconnectCurrent() {
    const current = driver;
    driver = null;
    markDisconnected();
    if (!current) return;
    try {
      await current.disconnect();
    } catch {
      // Bağlantı zaten kopmuş olabilir.
    } finally {
      // UDP bağlantısı kurulmadan zaman aşımına uğrarsa zkteco-js connectionType
      // atamadığı için disconnect() soketi kapatmıyor. Sonraki denemenin aynı
      // yerel porta bağlanabilmesi için iki taşıyıcının soketini de kesin kapat.
      await Promise.allSettled([
        Promise.resolve().then(() => current.ztcp?.closeSocket?.()),
        Promise.resolve().then(() => current.zudp?.closeSocket?.()),
      ]);
    }
  }

  async function connect() {
    ensureSupportedConfig();
    if (connected && driver) return driver;
    if (connecting) return connecting;

    connecting = (async () => {
      await disconnectCurrent();
      const current = driverFactory({
        host: device.host,
        port: device.port ?? 4370,
        timeoutMs,
        udpInPort,
        maxChunkBytes,
      });
      driver = current;
      try {
        await openSocketWithUdpFallback(current, markDisconnected);
        connected = true;

        // ZK cihazı tek komut kanalı kullanır; aynı sokette paralel komut gönderme.
        const attendanceResult = await current.getAttendances();
        const timeResult = await current.getTime().catch(() => null);
        pending.push(...recordsOf(attendanceResult));
        deviceTime = normalizeTime(timeResult);

        clearStaleRealtimeListeners(current);
        await current.getRealTimeLogs((record) => {
          if (record) pending.push(record);
        });
        subscribed = true;
        return current;
      } catch (error) {
        await disconnectCurrent();
        throw asDeviceError(error);
      }
    })();

    try {
      return await connecting;
    } finally {
      connecting = null;
    }
  }

  function toEvent(raw) {
    const userId = stringOrNull(raw?.user_id ?? raw?.userId);
    const time = normalizeTime(raw?.record_time ?? raw?.recordTime ?? raw?.attTime ?? raw?.time);
    if (!time) return null;
    const state = raw?.state ?? raw?.ioMode ?? null;
    const verifyMode = raw?.type ?? raw?.verifyMode ?? null;
    const direction = resolveDirection(device.direction, credentials.directionByState, state);
    const eventId = `zk-${crypto
      .createHash('sha256')
      .update([device.host, raw?.sn ?? '', userId ?? '', time, verifyMode ?? '', state ?? ''].join('|'))
      .digest('hex')
      .slice(0, 32)}`;

    return {
      eventId,
      userId,
      card: null,
      time,
      direction,
      // Standalone protokol doğrulama sonucunu güvenilir biçimde bildirmiyor.
      result: null,
      verifyMode: verifyMode == null ? null : String(verifyMode),
      raw: compactRaw(raw),
    };
  }

  return {
    protocol: device.protocol,

    async ping() {
      await connect();
      return { deviceTime };
    },

    async readEvents(cursor) {
      try {
        await connect();
        if (!subscribed) throw new DeviceError('ZK gerçek zamanlı olay aboneliği kurulamadı.', { transient: true });
        const batch = pending;
        pending = [];
        const events = batch.map(toEvent).filter(Boolean);
        return {
          events,
          cursor: {
            ...(cursor && typeof cursor === 'object' ? cursor : {}),
            lastReadAt: new Date().toISOString(),
          },
          deviceTime,
        };
      } catch (error) {
        markDisconnected();
        throw asDeviceError(error);
      }
    },

    async applyUser() {
      throw new DeviceError('ZK TCP/4370 için güvenli kullanıcı senkronu henüz etkin değil.');
    },

    close() {
      void disconnectCurrent();
    },
  };
}

/**
 * zkteco-js 1.7.2 TCP reddedildiğinde UDP'ye geçmeyi amaçlıyor; ancak hata birkaç
 * kat sarıldığı için ECONNREFUSED kodunu göremiyor. Cihaz yalnızca UDP/4370
 * dinliyorsa burada kontrollü olarak UDP kanalını açıyoruz.
 */
async function openSocketWithUdpFallback(driver, onDisconnect) {
  try {
    await driver.createSocket(onDisconnect, onDisconnect);
  } catch (error) {
    if (!hasErrorCode(error, 'ECONNREFUSED') || !driver?.zudp) throw error;
    if (!driver.zudp.socket) await driver.zudp.createSocket(onDisconnect, onDisconnect);
    await driver.zudp.connect();
    driver.connectionType = 'udp';
  }
}

function hasErrorCode(error, expectedCode) {
  let current = error;
  for (let depth = 0; depth < 6 && current; depth++) {
    if (current.code === expectedCode) return true;
    current = current.err ?? current.cause;
  }
  return false;
}

/**
 * zkteco-js UDP komutlarından sonra bazı cihazlarda bir `message` listener'ı
 * bırakıyor. getRealTimeLogs listener sayısı sıfır değilse canlı dinleyiciyi
 * kurmadığından, bütün sıralı sorgular tamamlandıktan sonra yalnızca veri
 * listener'larını temizliyoruz. error/close listener'larına dokunulmaz.
 */
function clearStaleRealtimeListeners(driver) {
  if (driver?.connectionType === 'udp') {
    driver.zudp?.socket?.removeAllListeners?.('message');
  } else if (driver?.connectionType === 'tcp') {
    driver.ztcp?.socket?.removeAllListeners?.('data');
  }
}

function recordsOf(result) {
  if (Array.isArray(result)) return result;
  return Array.isArray(result?.data) ? result.data : [];
}

function positiveInt(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function stringOrNull(value) {
  if (value == null || value === '') return null;
  return String(value).trim() || null;
}

function normalizeTime(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const istanbul = toIstanbulIso(value);
  if (istanbul) return istanbul;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function resolveDirection(gateDirection, directionByState, state) {
  const configured = directionByState?.[String(state)];
  if (configured === 'in' || configured === 'out') return configured;
  return gateDirection === 'in' || gateDirection === 'out' ? gateDirection : null;
}

function compactRaw(raw) {
  return {
    sn: raw?.sn ?? null,
    state: raw?.state ?? raw?.ioMode ?? null,
    type: raw?.type ?? raw?.verifyMode ?? null,
  };
}

module.exports = {
  createZkTcpAdapter,
  normalizeTime,
  resolveDirection,
  openSocketWithUdpFallback,
  clearStaleRealtimeListeners,
};
