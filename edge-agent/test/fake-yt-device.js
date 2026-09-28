'use strict';

/**
 * Test için sahte YT cihazı: HTTP Digest (MD5, qop=auth) + /bin/cmd.
 * Tel biçimi src/adapters/yt-wire.js ile aynı varsayımları kullanır.
 */

const http = require('node:http');
const crypto = require('node:crypto');

const md5 = (v) => crypto.createHash('md5').update(v).digest('hex');
const REALM = 'yt-device';

function startFakeYtDevice({ username = 'admin', password = 'secret' } = {}) {
  const state = {
    users: new Map(),
    logs: [],
    requests: [],
    ignoreVaildEnd: false,
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
          const inWindow = state.logs.filter((l) => l.time.slice(0, 8) >= data.beginTime && l.time.slice(0, 8) <= data.endTime);
          const start = data.page * data.pageCount;
          return reply(0, { allLogCount: inWindow.length, logs: inWindow.slice(start, start + data.pageCount) });
        }
        case 'GetUserInfo': {
          const user = state.users.get(data.userId);
          return user ? reply(0, user) : reply(1, null, 'user not exist');
        }
        case 'SetUserInfo': {
          const user = { ...data };
          if (state.ignoreVaildEnd) user.vaildEnd = '20991231';
          state.users.set(user.userId, user);
          return reply(0, null);
        }
        case 'DeleteUserInfo':
          return state.users.delete(data.userId) ? reply(0, null) : reply(1, null, 'user not exist');
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
