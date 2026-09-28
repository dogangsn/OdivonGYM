'use strict';

/**
 * YT HTTP Digest adapteri.
 *
 * Kullanıcı eşlemesi: MainApi üye numarası → cihaz `userId` (sabit), RFID → `card`,
 * üyelik bitiş günü → `vaildEnd=YYYYMMDD` (Türkiye saatiyle o günün sonuna kadar).
 * Yetki kapatma → DeleteUserInfo. Yüz/parmak izi şablonları aktarılmaz.
 *
 * Her yazma işleminden sonra GetUserInfo ile geri okunur; yalnızca alanlar
 * eşleşirse `verified: true` döner.
 */

const crypto = require('node:crypto');
const { DigestClient } = require('../digest');
const { DeviceError, asDeviceError } = require('./errors');
const wire = require('./yt-wire');
const { toIstanbulIso } = require('../time');

const MAX_PAGES_PER_POLL = 20;
const NO_END_DATE = '20991231';
const MAX_NAME_LENGTH = 24;

/** Cihaz ekranı için ad: Türkçe karakterler ASCII'ye indirgenir, uzunluk sınırlanır. */
function deviceName(name) {
  const map = { ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I', ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U' };
  return String(name ?? '')
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => map[ch])
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

/** Kart numaralarını karşılaştırmak için baştaki sıfırları yok say. */
function sameCard(a, b) {
  const norm = (v) => String(v ?? '').trim().replace(/^0+(?=.)/, '');
  return norm(a) === norm(b);
}

function createYtHttpDigestAdapter(device, credentials, { fetchImpl } = {}) {
  if (!credentials?.username) {
    const reason = `config.json içinde "${device.host}" için cihaz kullanıcı adı/parolası yok (credentials).`;
    return {
      protocol: device.protocol,
      ping: async () => { throw new DeviceError(reason); },
      readEvents: async () => { throw new DeviceError(reason); },
      applyUser: async () => { throw new DeviceError(reason); },
      close() {},
    };
  }

  const port = device.port ?? 80;
  const http = new DigestClient({
    baseUrl: `http://${device.host}${port === 80 ? '' : `:${port}`}`,
    username: credentials.username,
    password: credentials.password ?? '',
    timeoutMs: credentials.timeoutMs ?? 5000,
    fetchImpl,
  });

  async function cmd(body) {
    let res;
    try {
      res = await http.request('POST', wire.CMD_PATH, {
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      throw asDeviceError(err);
    }
    const text = await res.text();
    if (!res.ok) {
      throw new DeviceError(`Cihaz HTTP ${res.status} döndü (${body.cmd})`, { transient: res.status >= 500 });
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new DeviceError(`Cihaz yanıtı JSON değil (${body.cmd}): ${text.slice(0, 120)}`);
    }
  }

  async function getUser(userId) {
    const res = await cmd(wire.requests.getUser(userId));
    if (wire.isNotFound(res)) return null;
    if (!wire.isOk(res)) throw new DeviceError(`GetUserInfo başarısız: ${JSON.stringify(res).slice(0, 200)}`);
    return wire.readUser(res);
  }

  function toEvent(raw) {
    const rec = wire.readLogRecord(raw);
    const time = toIstanbulIso(rec.time);
    const eventId =
      rec.recordId != null
        ? `yt-${rec.recordId}`
        : `yt-h-${crypto
            .createHash('sha1')
            .update([rec.userId, rec.card, rec.time, rec.verifyMode].join('|'))
            .digest('hex')
            .slice(0, 20)}`;
    return {
      eventId,
      userId: rec.userId,
      card: rec.card,
      time,
      direction: rec.direction ?? (device.direction === 'out' ? 'out' : 'in'),
      result: rec.result,
      verifyMode: rec.verifyMode != null ? String(rec.verifyMode) : null,
      raw,
    };
  }

  return {
    protocol: device.protocol,

    async ping() {
      const res = await cmd(wire.requests.getLogPage(1));
      if (!wire.isOk(res)) throw new DeviceError('Cihaz GetLogDataPage isteğini reddetti.');
      return {};
    },

    /**
     * Cursor: { total, page }. Son okunan sayfadan başlayıp sona kadar okur
     * (poll başına en çok MAX_PAGES_PER_POLL sayfa; kalanı sonraki turda).
     * Toplam azalırsa cihaz logu silinmiştir, baştan okunur. Tekrarlar
     * yerel `seen` tablosu ve MainApi'deki {gateId}_{eventId} ile ayıklanır.
     */
    async readEvents(cursor) {
      let page = cursor?.page ?? 1;
      const events = [];
      let total = cursor?.total ?? 0;

      for (let read = 0; read < MAX_PAGES_PER_POLL; read++) {
        const res = await cmd(wire.requests.getLogPage(page));
        if (!wire.isOk(res)) throw new DeviceError(`GetLogDataPage başarısız: ${JSON.stringify(res).slice(0, 200)}`);
        const parsed = wire.parseLogPage(res);
        if (read === 0 && cursor && parsed.total < cursor.total) {
          // Cihaz logu temizlenmiş veya başa sarmış.
          page = 1;
          total = 0;
          continue;
        }
        total = parsed.total;
        for (const raw of parsed.records) events.push(toEvent(raw));
        const lastPage = Math.max(1, Math.ceil(total / wire.LOG_PAGE_SIZE));
        if (page >= lastPage || parsed.records.length === 0) break;
        page += 1;
      }
      return { events, cursor: { total, page } };
    },

    async applyUser(item) {
      if (!item.userId) throw new DeviceError('Üyenin üye numarası yok; cihaz kullanıcı kimliği oluşturulamaz.');

      if (!item.enabled) {
        const res = await cmd(wire.requests.deleteUser(item.userId));
        if (!wire.isOk(res) && !wire.isNotFound(res)) {
          throw new DeviceError(`DeleteUserInfo başarısız: ${JSON.stringify(res).slice(0, 200)}`);
        }
        const after = await getUser(item.userId);
        return { verified: after === null };
      }

      const desired = {
        userId: item.userId,
        name: deviceName(item.name) || item.userId,
        card: item.card ?? '',
        vaildEnd: item.validEnd ?? NO_END_DATE,
      };
      const res = await cmd(wire.requests.setUser(desired));
      if (!wire.isOk(res)) throw new DeviceError(`SetUserInfo başarısız: ${JSON.stringify(res).slice(0, 200)}`);

      const after = await getUser(item.userId);
      const verified =
        !!after &&
        after.userId === desired.userId &&
        sameCard(after.card, desired.card) &&
        after.vaildEnd === desired.vaildEnd;
      return { verified };
    },

    close() {},
  };
}

module.exports = { createYtHttpDigestAdapter, deviceName };
