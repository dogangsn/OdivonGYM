'use strict';

/**
 * Test için sahte YT cihazı: HTTP Digest (MD5, qop=auth) + /bin/cmd.
 * Salondaki gerçek cihazda gözlenen davranışı taklit eder (bkz. src/adapters/yt-wire.js).
 */

const http = require('node:http');
const crypto = require('node:crypto');

const md5 = (v) => crypto.createHash('md5').update(v).digest('hex');
const REALM = 'yt-device';
const MAX_LOG_PAGE = 30;

function startFakeYtDevice({ username = 'admin', password = 'secret' } = {}) {
  const state = {
    users: new Map(),
    logs: [],
    requests: [],
    ignoreVaildEnd: false,
    busyOnce: false,
    down: false,
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  function authorized(req) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Digest ')) return false;
    const p = {};
    for (const m of header.slice(7).matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]*))/g)) p[m[1]] = m[2] ?? m[3];
    if (p.username !== username || p.nonce !== state.nonce) return false;
    const ha1 = md5(`${username}:${REALM}:${password}`);
    const ha2 = md5(`${req.method}:${p.uri}`);
    return p.response === md5(`${ha1}:${p.nonce}:${p.nc}:${p.cnonce}:${p.qop}:${ha2}`);
  }

  const server = http.createServer((req, res) => {
    if (state.down) return req.socket.destroy();
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      if (!authorized(req)) {
        res.writeHead(401, { 'WWW-Authenticate': `Digest realm="${REALM}", qop="auth", nonce="${state.nonce}"` });
        return res.end();
      }
      const { cmd, data = {} } = JSON.parse(body);
      state.requests.push({ cmd, data });
      const reply = (result_code, result_data, result_msg) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ cmd, result_code, result_msg, result_data }));
      };
      switch (cmd) {
        case 'GetLogDataPage': {
          // Gerçek cihaz gibi: sayfa başına en çok 30 kayıt.
          const size = Math.min(Number(data.pageCount) || 0, MAX_LOG_PAGE);
          const inWindow = state.logs.filter((l) => l.time.slice(0, 8) >= data.beginTime && l.time.slice(0, 8) <= data.endTime);
          const start = data.page * size;
          return reply(0, { allLogCount: inWindow.length, logs: inWindow.slice(start, start + size) });
        }
        case 'GetUserInfo': {
          if (state.busyOnce) {
            state.busyOnce = false;
            return reply(-2);
          }
          const users = (data.usersId ?? []).map((id) => state.users.get(String(id))).filter(Boolean);
          return reply(0, { packageId: 0, users: users.length ? users : null, usersCount: users.length });
        }
        case 'SetUserInfo': {
          for (const { update, ...user } of data.users ?? []) {
            if (state.ignoreVaildEnd) user.vaildEnd = '20991231';
            state.users.set(String(user.userId), { privilege: 0, ...user, name: String(user.name ?? '').slice(0, 9) });
          }
          return reply(0);
        }
        case 'DeleteUserInfo': {
          // Gerçek cihaz olmayan kullanıcı için de 0 döner ve kimliği result_data.userId içinde verir.
          const missing = (data.usersId ?? []).filter((id) => !state.users.delete(String(id)));
          return missing.length ? reply(0, { userId: missing }) : reply(0);
        }
        default:
          return reply(1, null, 'unknown cmd');
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        state,
        host: '127.0.0.1',
        port: server.address().port,
        /** n kayıt ekler; her kayıt bir saniye sonra (aynı gün içinde benzersiz zaman). */
        addLogs(n, day = '20260928') {
          for (let i = 0; i < n; i++) {
            const seq = state.logs.length;
            const secs = 8 * 3600 + seq;
            const hh = String(Math.floor(secs / 3600)).padStart(2, '0');
            const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
            const ss = String(secs % 60).padStart(2, '0');
            state.logs.push({ time: `${day}${hh}${mm}${ss}`, userId: String(1000 + (seq % 7)), verifyMode: 'face', ioMode: seq % 2 });
          }
        },
        close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }),
      });
    });
  });
}

module.exports = { startFakeYtDevice };
