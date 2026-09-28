'use strict';

/**
 * Test için sahte YT cihazı: HTTP Digest (MD5, qop=auth) + /bin/cmd.
 * Tel biçimi src/adapters/yt-wire.js ile aynı varsayımları kullanır.
 */

const http = require('node:http');
const crypto = require('node:crypto');

const md5 = (v) => crypto.createHash('md5').update(v).digest('hex');
const REALM = 'yt-device';

function startFakeYtDevice({ username = 'admin', password = 'secret', pageSize = 100 } = {}) {
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
      const cmd = JSON.parse(body);
      state.requests.push(cmd);
      const reply = (obj) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      switch (cmd.cmd) {
        case 'GetLogDataPage': {
          const size = cmd.pageSize ?? pageSize;
          const start = (cmd.page - 1) * size;
          return reply({ result: 0, total: state.logs.length, page: cmd.page, data: state.logs.slice(start, start + size) });
        }
        case 'GetUserInfo': {
          const user = state.users.get(cmd.userId);
          return user ? reply({ result: 0, data: user }) : reply({ result: 4, msg: 'user not exist' });
        }
        case 'SetUserInfo': {
          const user = { ...cmd.data };
          if (state.ignoreVaildEnd) user.vaildEnd = '20991231';
          state.users.set(user.userId, user);
          return reply({ result: 0 });
        }
        case 'DeleteUserInfo':
          return state.users.delete(cmd.userId) ? reply({ result: 0 }) : reply({ result: 4, msg: 'user not exist' });
        default:
          return reply({ result: 1, msg: 'unknown cmd' });
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        state,
        host: '127.0.0.1',
        port: server.address().port,
        addLogs(n, from = state.logs.length) {
          for (let i = 0; i < n; i++) {
            const id = from + i + 1;
            state.logs.push({ id, userId: String(1000 + (id % 7)), card: '', time: '2026-09-28 21:14:05', verifyMode: 1 });
          }
        },
        close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }),
      });
    });
  });
}

module.exports = { startFakeYtDevice };
