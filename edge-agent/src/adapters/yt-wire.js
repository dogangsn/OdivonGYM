'use strict';

/**
 * YT cihazının HTTP Digest `/bin/cmd` tel biçimi (istek gövdeleri ve yanıt alanları).
 *
 * ⚠️ DOĞRULANACAK: Bu dosyadaki alan adları ve gövde biçimi gerçek cihazdan alınmış
 * örnek istek/yanıtla birebir karşılaştırılmalıdır. Adapterin geri kalanı (sayfalama,
 * geri okuma doğrulaması, idempotent uygulama, kuyruk) biçimden bağımsızdır; biçim
 * farklıysa yalnızca bu dosya ve test/fake-yt-device.js güncellenir.
 *
 * Bilinenler (plan): komutlar GetLogDataPage, GetUserInfo, SetUserInfo, DeleteUserInfo;
 * kullanıcı alanları `userId`, `card`, `vaildEnd` (cihazdaki yazımıyla, YYYYMMDD).
 */

const CMD_PATH = '/bin/cmd';
const LOG_PAGE_SIZE = 100;

/** Cihazın "başarılı" yanıtı. */
function isOk(res) {
  return res && (res.result === 0 || res.result === '0' || res.code === 0 || res.status === 'ok');
}

/** Kullanıcı bulunamadı yanıtı (GetUserInfo / DeleteUserInfo). */
function isNotFound(res) {
  if (!res || isOk(res)) return false;
  const text = `${res.msg ?? res.message ?? ''}`.toLowerCase();
  return res.result === 4 || text.includes('not exist') || text.includes('not found') || text.includes('no user');
}

const requests = {
  getLogPage: (page) => ({ cmd: 'GetLogDataPage', page, pageSize: LOG_PAGE_SIZE }),
  getUser: (userId) => ({ cmd: 'GetUserInfo', userId }),
  setUser: (user) => ({ cmd: 'SetUserInfo', data: user }),
  deleteUser: (userId) => ({ cmd: 'DeleteUserInfo', userId }),
};

/** GetLogDataPage yanıtı → { total, records[] } */
function parseLogPage(res) {
  const records = res.data ?? res.logs ?? res.records ?? [];
  const total = Number(res.total ?? res.count ?? res.totalCount ?? records.length);
  return { total, records: Array.isArray(records) ? records : [] };
}

/** Ham log kaydı → sözleşmedeki alanlar (eventId ve time adapter'da tamamlanır). */
function readLogRecord(raw) {
  return {
    recordId: raw.id ?? raw.logId ?? raw.index ?? raw.recordId ?? null,
    userId: raw.userId != null ? String(raw.userId) : null,
    card: raw.card != null && raw.card !== '' ? String(raw.card) : null,
    time: raw.time ?? raw.logTime ?? raw.recordTime ?? null,
    verifyMode: raw.verifyMode ?? raw.verify ?? raw.mode ?? null,
    // Cihaz yön bildirirse kullanılır; bildirmezse cihaz kaydındaki yön varsayılır.
    direction: raw.inOut === 1 || raw.inOut === 'out' ? 'out' : raw.inOut === 0 || raw.inOut === 'in' ? 'in' : null,
    // Cihaz geçiş sonucunu bildirmiyorsa null kalır; agent tahmin etmez.
    result: raw.pass === true || raw.result === 'granted' ? 'granted' : raw.pass === false || raw.result === 'denied' ? 'denied' : null,
  };
}

/** GetUserInfo yanıtı → { userId, name, card, vaildEnd } | null */
function readUser(res) {
  const data = Array.isArray(res.data) ? res.data[0] : res.data ?? res.user;
  if (!data) return null;
  return {
    userId: String(data.userId ?? ''),
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
  requests,
  parseLogPage,
  readLogRecord,
  readUser,
};
