'use strict';

/**
 * YT cihazının `/bin/cmd` tel biçimi (istek gövdeleri ve yanıt alanları).
 *
 * Bilinen (salondaki önceki agent sürümünden):
 *   - Her çağrı: POST /bin/cmd, gövde {"cmd": <ad>, "data": {...}}
 *   - Yanıt:     {"cmd", "result_code": 0 (başarılı), "result_msg", "result_data": {...}}
 *   - GetLogDataPage data: {beginTime: "YYYYMMDD", endTime: "YYYYMMDD", page (0'dan), pageCount}
 *     result_data: {allLogCount, logs: [{time: "YYYYMMDDHHMMSS", userId, verifyMode, ioMode}]}
 *     ioMode 0 = giriş, 1 = çıkış, 10 = kapı. Kayıtlarda benzersiz kimlik ve izin/red alanı yok.
 *
 * ⚠️ DOĞRULANACAK: GetUserInfo / SetUserInfo / DeleteUserInfo gövdeleri ve kullanıcı alan
 * adları (`userId`, `name`, `card`, `vaildEnd`) plandan alındı; gerçek cihazdan örnek
 * istek/yanıtla karşılaştırılmalı. Biçim farklıysa yalnızca bu dosya ve
 * test/fake-yt-device.js güncellenir.
 */

const CMD_PATH = '/bin/cmd';
const LOG_PAGE_SIZE = 500;
const FAR_FUTURE_DAY = '20991231';

function isOk(res) {
  return !!res && Number(res.result_code) === 0;
}

/** Kullanıcı bulunamadı yanıtı (GetUserInfo / DeleteUserInfo). */
function isNotFound(res) {
  if (!res || isOk(res)) return false;
  const text = `${res.result_msg ?? ''}`.toLowerCase();
  return text.includes('not exist') || text.includes('not found') || text.includes('no user');
}

function describe(res) {
  return `result_code=${res?.result_code} ${res?.result_msg ?? ''}`.trim();
}

const requests = {
  getLogPage: ({ beginDay, page }) => ({
    cmd: 'GetLogDataPage',
    data: { beginTime: beginDay, endTime: FAR_FUTURE_DAY, page, pageCount: LOG_PAGE_SIZE },
  }),
  getUser: (userId) => ({ cmd: 'GetUserInfo', data: { userId } }),
  setUser: (user) => ({ cmd: 'SetUserInfo', data: user }),
  deleteUser: (userId) => ({ cmd: 'DeleteUserInfo', data: { userId } }),
};

/** GetLogDataPage yanıtı → { total, records[] } */
function parseLogPage(res) {
  const data = res.result_data ?? {};
  const records = Array.isArray(data.logs) ? data.logs : [];
  return { total: Number(data.allLogCount ?? records.length), records };
}

/** Ham log kaydı → sözleşmedeki alanlar. */
function readLogRecord(raw) {
  const io = raw.ioMode == null ? null : Number(raw.ioMode);
  return {
    userId: raw.userId != null && raw.userId !== '' ? String(raw.userId) : null,
    card: raw.card != null && raw.card !== '' ? String(raw.card) : null,
    time: raw.time ?? null,
    verifyMode: raw.verifyMode ?? null,
    ioMode: io,
    // 0 = giriş, 1 = çıkış; 10 (kapı) ve bilinmeyenler için cihaz kaydındaki yön kullanılır.
    direction: io === 0 ? 'in' : io === 1 ? 'out' : null,
    // Cihaz izin/red bildirmiyor; agent tahmin etmez.
    result: null,
  };
}

/** GetUserInfo yanıtı → { userId, name, card, vaildEnd } | null */
function readUser(res) {
  const raw = res.result_data;
  const data = Array.isArray(raw) ? raw[0] : Array.isArray(raw?.users) ? raw.users[0] : raw?.user ?? raw;
  if (!data || data.userId == null) return null;
  return {
    userId: String(data.userId),
    name: data.name ?? '',
    card: data.card != null ? String(data.card) : '',
    vaildEnd: data.vaildEnd != null ? String(data.vaildEnd) : '',
  };
}

module.exports = {
  CMD_PATH,
  LOG_PAGE_SIZE,
  isOk,
  isNotFound,
  describe,
  requests,
  parseLogPage,
  readLogRecord,
  readUser,
};
