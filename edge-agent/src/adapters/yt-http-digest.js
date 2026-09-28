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
const { toIstanbulIso, istanbulDay } = require('../time');

const MAX_PAGES_PER_POLL = 20;
/** İlk çalıştırmada cihazdaki tüm geçmiş kayıtlar alınır (tekrar korumalı). */
const INITIAL_BEGIN_DAY = '20000101';
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

function createYtHttpDigestAdapter(device, credentials, { fetchImpl, now = () => new Date() } = {}) {
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
    if (!wire.isOk(res)) throw new DeviceError(`GetUserInfo başarısız: ${wire.describe(res)}`);
    return wire.readUser(res);
  }

  function toEvent(raw) {
    const rec = wire.readLogRecord(raw);
    // Cihaz kayıtlarında benzersiz kimlik yok: kimlik içerikten türetilir (aynı kayıt → aynı kimlik).
    const eventId = `yt-${crypto
      .createHash('sha1')
      .update([rec.userId, rec.card, rec.time, rec.verifyMode, rec.ioMode].join('|'))
      .digest('hex')
      .slice(0, 24)}`;
    return {
      eventId,
      userId: rec.userId,
      card: rec.card,
      time: toIstanbulIso(rec.time),
      direction: rec.direction ?? (device.direction === 'out' ? 'out' : 'in'),
      result: rec.result,
      verifyMode: rec.verifyMode != null ? String(rec.verifyMode) : null,
      raw,
    };
  }

  return {
    protocol: device.protocol,

    async ping() {
      const res = await cmd(wire.requests.getLogPage({ beginDay: istanbulDay(now()), page: 0 }));
      if (!wire.isOk(res)) throw new DeviceError(`GetLogDataPage reddedildi: ${wire.describe(res)}`);
      return {};
    },

    /**
     * Cursor: { beginDay, page, total }. Pencere [beginDay, ∞) içinde son okunan sayfadan
     * başlayıp sona kadar okur (tur başına en çok MAX_PAGES_PER_POLL sayfa).
     *  - İlk çalıştırma: beginDay = 2000-01-01, cihazdaki tüm kayıtlar alınır.
     *  - Yetişince pencere dünden (TR) başlar; gün değişince sayfa 0'a döner.
     *  - Toplam azalırsa cihaz logu silinmiştir; pencere baştan okunur.
     * Tekrarlar yerel `seen` tablosunda ve MainApi'de {gateId}_{eventId} ile ayıklanır.
     */
    async readEvents(cursor) {
      const yesterday = istanbulDay(now(), -1);
      let beginDay = cursor?.beginDay ?? INITIAL_BEGIN_DAY;
      let page = cursor?.page ?? 0;
      let total = cursor?.total ?? 0;
      let caughtUp = false;
      if (beginDay !== INITIAL_BEGIN_DAY && beginDay < yesterday) {
        beginDay = yesterday;
        page = 0;
        total = 0;
      }

      const events = [];
      for (let read = 0; read < MAX_PAGES_PER_POLL; read++) {
        const res = await cmd(wire.requests.getLogPage({ beginDay, page }));
        if (!wire.isOk(res)) throw new DeviceError(`GetLogDataPage başarısız: ${wire.describe(res)}`);
        const parsed = wire.parseLogPage(res);
        if (read === 0 && parsed.total < total) {
          // Cihaz logu temizlenmiş: pencereyi baştan oku.
          page = 0;
          total = 0;
          continue;
        }
        total = parsed.total;
        for (const raw of parsed.records) events.push(toEvent(raw));
        const lastPage = Math.max(0, Math.ceil(total / wire.LOG_PAGE_SIZE) - 1);
        if (page >= lastPage || parsed.records.length === 0) {
          caughtUp = true;
          break;
        }
        page += 1;
      }

      if (caughtUp && beginDay === INITIAL_BEGIN_DAY) {
        // Geçmiş aktarıldı; bundan sonra yalnızca dünden bugüne pencere okunur.
        return { events, cursor: { beginDay: yesterday, page: 0, total: 0 } };
      }
      return { events, cursor: { beginDay, page, total } };
    },

    async applyUser(item) {
      if (!item.userId) throw new DeviceError('Üyenin üye numarası yok; cihaz kullanıcı kimliği oluşturulamaz.');

      if (!item.enabled) {
        const res = await cmd(wire.requests.deleteUser(item.userId));
        if (!wire.isOk(res) && !wire.isNotFound(res)) {
          throw new DeviceError(`DeleteUserInfo başarısız: ${wire.describe(res)}`);
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
      if (!wire.isOk(res)) throw new DeviceError(`SetUserInfo başarısız: ${wire.describe(res)}`);

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
