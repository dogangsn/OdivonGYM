'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
const { DeviceError } = require('./errors');
const { toIstanbulIso } = require('../time');

const DEFAULT_START_TIMEOUT_MS = 120_000;
const COMMAND_TIMEOUT_MS = 30_000;
/** Tüm kullanıcı listesini UDP ile okumak eski cihazlarda dakikalar sürebilir. */
const LIST_TIMEOUT_MS = 15 * 60_000;
/** ZK cihazlarının çoğu en çok 24 karakter ad saklar; Türkçe harfler ASCII'ye indirgenir. */
const MAX_NAME_LENGTH = 24;

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
  let commandsSupported = false;
  let nextCommandId = 1;
  const inflight = new Map(); // id → { resolve, reject, timer }

  function failInflight(error) {
    for (const [id, waiter] of inflight) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
      inflight.delete(id);
    }
  }

  /** Köprüye komut gönderir; yanıt `{"type":"result","id":…}` satırıyla gelir. */
  async function command(cmd, payload = {}, timeoutMs = COMMAND_TIMEOUT_MS) {
    await start();
    if (!child?.stdin) throw new DeviceError('zkemkeeper köprüsü kapandı, tekrar denenecek.', { transient: true });
    if (!commandsSupported) {
      throw new DeviceError('Bu köprü sürümü cihaza yazmayı desteklemiyor; agent kurulumunu güncelleyin.');
    }
    const id = nextCommandId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        inflight.delete(id);
        reject(new DeviceError(`Cihaz ${cmd} komutuna ${Math.round(timeoutMs / 1000)} sn içinde cevap vermedi.`, { transient: true }));
      }, timeoutMs);
      inflight.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ id, cmd, ...payload })}\n`);
    });
  }

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
        bridgeArgs(device, credentials),
        {
          cwd: path.dirname(bridgePath),
          windowsHide: true,
          // stdin: agent → köprü komutları. Agent kapanınca stdin kapanır ve köprü de kapanır.
          stdio: ['pipe', 'pipe', 'pipe'],
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
          const event = bridgeMessageToEvent(device, message, { useAgentClock: credentials.useAgentClock === true });
          if (event) pending.push(event);
        } else if (message.type === 'result') {
          const waiter = inflight.get(message.id);
          if (waiter) {
            inflight.delete(message.id);
            clearTimeout(waiter.timer);
            if (message.ok) waiter.resolve(message.data ?? {});
            else waiter.reject(new DeviceError(message.error || 'Cihaz komutu başarısız.'));
          }
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
          commandsSupported = message.commands === true;
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
      bridge.stdin?.on('error', () => undefined);
      bridge.on('exit', (code) => {
        connected = false;
        child = null;
        failInflight(new DeviceError(`zkemkeeper köprüsü kapandı (kod ${code ?? 'yok'}).`, { transient: true }));
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

    /** Bitiş günü cihazda tutulamadığı için agent tarafından uygulanır (bkz. runtime.enforceExpiry). */
    localExpiry: true,

    async getUser(userId) {
      const data = await command('getUser', { enrollNumber: String(userId) });
      return data.found ? data.user : null;
    },

    async listUsers() {
      const data = await command('listUsers', {}, LIST_TIMEOUT_MS);
      // Eski köprü derlemesi alanları büyük harfle (EnrollNumber, Name, Card) ve aktiflik bilgisi olmadan gönderiyordu.
      return (data.users ?? []).map((user) => ({
        enrollNumber: user.enrollNumber ?? user.EnrollNumber ?? null,
        name: user.name ?? user.Name ?? null,
        card: user.card ?? user.Card ?? null,
        enabled: user.enabled ?? user.Enabled ?? null,
      }));
    },

    async deleteUser(userId) {
      await command('deleteUser', { enrollNumber: String(userId) });
      return { verified: (await this.getUser(userId)) === null };
    },

    /**
     * MainApi'nin istediği durumu uygular. Yetki kapatma kullanıcıyı silmez, cihazda pasif yapar:
     * parmak izi / yüz kayıtları kaybolmaz, üyelik yenilenince yeniden açılır.
     */
    async applyUser(item) {
      if (!item.userId) throw new DeviceError('Üyenin üye numarası yok; cihaz kullanıcı kimliği oluşturulamaz.');
      const userId = String(item.userId);

      if (item.replacesUserId && String(item.replacesUserId) !== userId) {
        const old = await this.getUser(item.replacesUserId);
        if (old && old.enabled) await command('enableUser', { enrollNumber: String(item.replacesUserId), enabled: false });
      }

      if (!item.enabled) {
        const existing = await this.getUser(userId);
        if (!existing) return { verified: true };
        if (existing.enabled) await command('enableUser', { enrollNumber: userId, enabled: false });
        const after = await this.getUser(userId);
        return after && after.enabled ? { verified: false, detail: 'kullanıcı hâlâ aktif' } : { verified: true };
      }

      const data = await command('setUser', {
        enrollNumber: userId,
        name: zkName(item.name) || userId,
        card: item.card ? String(item.card) : null,
        enabled: true,
      });
      const after = data.user ?? (await this.getUser(userId));
      if (!after) return { verified: false, detail: 'cihazda kullanıcı bulunamadı' };
      const diffs = [];
      if (!after.enabled) diffs.push('kullanıcı pasif');
      if (item.card && normCard(after.card) !== normCard(item.card)) diffs.push(`kart "${after.card ?? ''}" ≠ "${item.card}"`);
      return diffs.length ? { verified: false, detail: diffs.join(', ') } : { verified: true };
    },

    close() {
      connected = false;
      failInflight(new DeviceError('Cihaz bağlantısı kapatıldı.', { transient: true }));
      child?.kill();
      child = null;
      startPromise = null;
    },
  };
}

/** Köprü komut satırı. `skipHistory` / `skipUsers`: açılışta geçmişi / kullanıcı listesini okumadan canlı dinlemeye geç. */
function bridgeArgs(device, credentials = {}) {
  const args = ['--host', device.host, '--port', String(device.port ?? 4370), '--machine', String(credentials.machineNumber ?? 1)];
  if (credentials.skipHistory === true) args.push('--skip-history');
  if (credentials.skipUsers === true) args.push('--skip-users');
  return args;
}

/**
 * `useAgentClock`: cihaz saati yanlışsa canlı (realtime) olayda bilgisayarın o anki saati kullanılır;
 * cihazın yazdığı saat `raw.deviceTimestamp` içinde kalır. Geçmiş kayıtlar cihaz saatiyle kalır.
 */
function bridgeMessageToEvent(device, message, { useAgentClock = false, now = () => new Date() } = {}) {
  const userId = stringOrNull(message.enrollNumber);
  const card = stringOrNull(message.card);
  const agentClock = useAgentClock && message.source === 'realtime';
  const time = agentClock ? now().toISOString() : toIstanbulIso(message.timestamp);
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
      ...(agentClock ? { deviceTimestamp: message.timestamp ?? null } : {}),
    },
  };
}

function directionFromAttState(attState, fallback) {
  if ([0, 3, 4].includes(attState)) return 'in';
  if ([1, 2, 5].includes(attState)) return 'out';
  return fallback === 'in' || fallback === 'out' ? fallback : null;
}

function zkName(name) {
  const map = { ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I', ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U' };
  return String(name ?? '')
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => map[ch])
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

function normCard(value) {
  return String(value ?? '').trim().replace(/^0+(?=.)/, '');
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

module.exports = { createZkemkeeperComAdapter, bridgeArgs, bridgeMessageToEvent, directionFromAttState, zkName };
