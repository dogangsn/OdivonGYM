'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
const { DeviceError } = require('./errors');
const { toIstanbulIso } = require('../time');

const DEFAULT_START_TIMEOUT_MS = 120_000;

/** Eski 32-bit zkemkeeper.dll ile birebir olay sözleşmesini kullanan Windows adapteri. */
function createZkemkeeperComAdapter(device, credentials = {}, { spawnImpl = spawn } = {}) {
  const bridgePath = path.resolve(
    credentials.sdkBridgePath ?? path.join(__dirname, '..', '..', 'vendor', 'zkemkeeper', 'zkemkeeper-bridge.exe'),
  );
  const startTimeoutMs = positiveInt(credentials.bridgeStartTimeoutMs, DEFAULT_START_TIMEOUT_MS);
  let child = null;
  let startPromise = null;
  let connected = false;
  let pending = [];
  let deviceInfo = null;
  let lastBridgeError = null;

  function start() {
    if (connected && child) return Promise.resolve();
    if (startPromise) return startPromise;
    if (process.platform !== 'win32' && spawnImpl === spawn) {
      return Promise.reject(new DeviceError('zkemkeeper COM köprüsü yalnızca Windows üzerinde çalışır.'));
    }

    startPromise = new Promise((resolve, reject) => {
      let settled = false;
      let stderr = '';
      const bridge = spawnImpl(
        bridgePath,
        ['--host', device.host, '--port', String(device.port ?? 4370), '--machine', String(credentials.machineNumber ?? 1)],
        {
          cwd: path.dirname(bridgePath),
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      child = bridge;

      const timer = setTimeout(() => {
        const error = new DeviceError('zkemkeeper köprüsü başlatma zaman aşımına uğradı.', { transient: true });
        if (!settled) {
          settled = true;
          reject(error);
        }
        bridge.kill();
      }, startTimeoutMs);

      const lines = readline.createInterface({ input: bridge.stdout });
      lines.on('line', (line) => {
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          return;
        }
        if (message.type === 'event') {
          const event = bridgeMessageToEvent(device, message);
          if (event) pending.push(event);
        } else if (message.type === 'device') {
          deviceInfo = message;
        } else if (message.type === 'status') {
          connected = message.connected === true;
        } else if (message.type === 'error') {
          lastBridgeError = new DeviceError(message.message || 'zkemkeeper köprü hatası.', { transient: true });
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(lastBridgeError);
          }
        } else if (message.type === 'ready') {
          connected = true;
          lastBridgeError = null;
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
        }
      });

      bridge.stderr.on('data', (chunk) => {
        stderr = `${stderr}${chunk}`.slice(-2_000);
      });
      bridge.on('error', (error) => {
        const wrapped = new DeviceError(`zkemkeeper köprüsü çalıştırılamadı: ${error.message}`, {
          transient: true,
          cause: error,
        });
        lastBridgeError = wrapped;
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(wrapped);
        }
      });
      bridge.on('exit', (code) => {
        connected = false;
        child = null;
        startPromise = null;
        lines.close();
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(
            lastBridgeError ??
              new DeviceError(`zkemkeeper köprüsü kapandı (kod ${code ?? 'yok'}). ${stderr}`.trim(), { transient: true }),
          );
        }
      });
    });

    return startPromise.catch((error) => {
      startPromise = null;
      throw error;
    });
  }

  return {
    protocol: device.protocol,

    async ping() {
      await start();
      if (lastBridgeError) throw lastBridgeError;
      return { deviceTime: null, deviceInfo };
    },

    async readEvents(cursor) {
      await start();
      if (lastBridgeError) throw lastBridgeError;
      const events = pending;
      pending = [];
      return {
        events,
        cursor: {
          ...(cursor && typeof cursor === 'object' ? cursor : {}),
          lastReadAt: new Date().toISOString(),
          driver: 'zkemkeeper-com',
        },
        deviceTime: null,
      };
    },

    async applyUser() {
      throw new DeviceError('zkemkeeper COM adapterinde kullanıcı yazma henüz etkin değil.');
    },

    close() {
      connected = false;
      child?.kill();
      child = null;
      startPromise = null;
    },
  };
}

function bridgeMessageToEvent(device, message) {
  const userId = stringOrNull(message.enrollNumber);
  const card = stringOrNull(message.card);
  const time = toIstanbulIso(message.timestamp);
  if (!time) return null;
  const verifyMode = message.verifyMethod == null ? null : String(message.verifyMethod);
  const attState = numberOrNull(message.attState);
  const isInvalid = numberOrNull(message.isInvalid);
  const direction = directionFromAttState(attState, device.direction);
  const result = isInvalid == null ? null : isInvalid === 0 ? 'granted' : 'denied';
  const eventId = `zk-${crypto
    .createHash('sha256')
    .update(
      [
        device.host,
        userId ?? '',
        card ?? '',
        time,
        verifyMode ?? '',
        attState ?? '',
        message.workCode ?? '',
      ].join('|'),
    )
    .digest('hex')
    .slice(0, 32)}`;

  return {
    eventId,
    userId,
    card,
    time,
    direction,
    result,
    verifyMode,
    raw: {
      driver: 'zkemkeeper-com',
      source: message.source ?? null,
      enrollNumber: userId,
      deviceUserName: stringOrNull(message.deviceUserName),
      isInvalid,
      attState,
      verifyMethod: numberOrNull(message.verifyMethod),
      workCode: numberOrNull(message.workCode),
    },
  };
}

function directionFromAttState(attState, fallback) {
  if ([0, 3, 4].includes(attState)) return 'in';
  if ([1, 2, 5].includes(attState)) return 'out';
  return fallback === 'in' || fallback === 'out' ? fallback : null;
}

function positiveInt(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringOrNull(value) {
  if (value == null || value === '') return null;
  return String(value).trim() || null;
}

module.exports = { createZkemkeeperComAdapter, bridgeMessageToEvent, directionFromAttState };
