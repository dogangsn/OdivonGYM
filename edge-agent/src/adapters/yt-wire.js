'use strict';

/**
 * YT cihazının `/bin/cmd` tel biçimi (istek gövdeleri ve yanıt alanları).
 *
 * Salondaki cihazda doğrulandı (firmware K4E_2Y1Kbc011_2.9, HTTP Digest MD5 qop=auth):
 *   - Her çağrı: POST /bin/cmd, gövde {"cmd": <ad>, "data": {...}}
 *   - Yanıt:     {"cmd", "result_code": 0 (başarılı), "result_msg"?, "result_data"?}
 *     Ardışık isteklerde bazen geçici olarak result_code -2 döner; kısa beklemeyle tekrar denenir.
 *   - GetLogDataPage data: {beginTime: "YYYYMMDD", endTime: "YYYYMMDD", page (0'dan), pageCount}
 *     Cihaz sayfa başına en çok 30 kayıt döndürür (pageCount daha büyük verilse de).
 *     result_data: {allLogCount, logs: [{time: "YYYYMMDDHHMMSS", userId, verifyMode, ioMode}]}
 *     ioMode 0 = giriş, 1 = çıkış, 10 = kapı. Kayıtlarda benzersiz kimlik, kart no ve izin/red yok.
 *   - GetUserInfo data: {packageId: 0, usersId: ["1042"]}
 *     result_data: {packageId, usersCount, users: [{userId, name, card?, privilege, vaildStart, vaildEnd}] | null}
 *     Kullanıcı yoksa result_code 0 ve users null. vaildEnd "00000000" = süresiz.
 *   - SetUserInfo data: {users: [{userId, name, card, vaildStart, vaildEnd, update: 1}]}
 *     Başarısız kullanıcılar result_data.usersId içinde döner. Ad en çok 9 karakter saklanır;
 *     Latin-1 dışı harfler (ör. İ, Ş, Ğ) adı keser, bu yüzden ad ASCII'ye indirgenir.
 *   - DeleteUserInfo data: {usersCount: 1, usersId: ["1042"]}
 *     Olmayan kullanıcı için de result_code 0 döner; kimlik result_data.userId içinde gelir.
 */

const CMD_PATH = '/bin/cmd';
const LOG_PAGE_SIZE = 30;
/** Geçici "meşgul" yanıtı. */
const BUSY_CODE = -2;
const NO_START_DAY = '20000101';
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

function isBusy(res) {
  return !!res && Number(res.result_code) === BUSY_CODE;
}

/** SetUserInfo yanıtında kullanıcı başarısızlar listesinde mi? */
function userRejected(res, userId) {
  const failed = res?.result_data?.usersId;
  return Array.isArray(failed) && failed.map(String).includes(String(userId));
}

function describe(res) {
  return `result_code=${res?.result_code} ${res?.result_msg ?? ''}`.trim();
}

const requests = {
  getLogPage: ({ beginDay, page }) => ({
    cmd: 'GetLogDataPage',
    data: { beginTime: beginDay, endTime: FAR_FUTURE_DAY, page, pageCount: LOG_PAGE_SIZE },
  }),
  getUser: (userId) => ({ cmd: 'GetUserInfo', data: { packageId: 0, usersId: [String(userId)] } }),
  setUser: (user) => ({
    cmd: 'SetUserInfo',
    data: { users: [{ vaildStart: NO_START_DAY, ...user, userId: String(user.userId), update: 1 }] },
  }),
  deleteUser: (userId) => ({ cmd: 'DeleteUserInfo', data: { usersCount: 1, usersId: [String(userId)] } }),
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
  isBusy,
  userRejected,
  describe,
  requests,
  parseLogPage,
  readLogRecord,
  readUser,
};
