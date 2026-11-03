'use strict';

/**
 * Yerel yönetim arayüzü: yalnızca 127.0.0.1 üzerinde dinler.
 *
 *   GET  /                    → tek sayfa arayüz (ui/index.html)
 *   GET  /api/status          → agent, MainApi, cihazlar, kuyruk, son geçişler
 *   POST /api/pair {code}     → eşleştirme kodu ile kaydol
 *   GET  /api/config          → ayarlar (parolalar gizli)
 *   PUT  /api/config          → ayarları kaydet ve cihaz bağlantılarını yeniden kur
 *   GET  /api/logs            → filtreli günlük (?level=&q=&kind=&afterSeq=&limit=)
 *   GET  /api/logs/stream     → canlı günlük (Server-Sent Events)
 *   GET  /api/devices/:gateId/users          → cihazdaki tüm kullanıcılar (yavaş olabilir)
 *   GET  /api/devices/:gateId/users/:userId  → tek kullanıcı + agent'ın bildiği bitiş günü
 *   PUT  /api/devices/:gateId/users/:userId  → yaz {name, card, validEnd, enabled}
 *   DELETE /api/devices/:gateId/users/:userId → sil
 *
 * Başka bir web sitesinin tarayıcı üzerinden bu uçlara istek atmasını engellemek için
 * Host başlığı localhost olmalı, değiştiren istekler JSON olmalı ve Origin (varsa) aynı olmalı.
 */

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const MASK = '********';
const INDEX_FILE = path.join(__dirname, '..', 'ui', 'index.html');

function createUiServer({ port = 47800, host = '127.0.0.1', logger, getStatus, pair, readConfig, writeConfig, deviceUsers = null }) {
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);

  const server = http.createServer(async (req, res) => {
    try {
      if (!allowedHosts.has(String(req.headers.host || '').toLowerCase())) return send(res, 403, { error: 'Yalnızca bu bilgisayardan erişilebilir.' });
      const url = new URL(req.url, `http://${req.headers.host}`);
      const mutating = req.method !== 'GET' && req.method !== 'HEAD';
      if (mutating) {
        const origin = req.headers.origin;
        if (origin && !allowedHosts.has(origin.replace(/^https?:\/\//, '').toLowerCase())) return send(res, 403, { error: 'Geçersiz kaynak.' });
        if (!String(req.headers['content-type'] || '').includes('application/json')) return send(res, 415, { error: 'JSON bekleniyor.' });
      }

      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(fs.readFileSync(INDEX_FILE));
      }
      if (req.method === 'GET' && url.pathname === '/api/status') return send(res, 200, await getStatus());
      if (req.method === 'POST' && url.pathname === '/api/pair') {
        const body = await readJson(req);
        const result = await pair(String(body.code || ''));
        return send(res, 200, result);
      }
      if (req.method === 'GET' && url.pathname === '/api/config') return send(res, 200, maskConfig(readConfig()));
      if (req.method === 'PUT' && url.pathname === '/api/config') {
        const body = await readJson(req);
        const merged = unmaskConfig(body, readConfig());
        await writeConfig(merged);
        return send(res, 200, maskConfig(merged));
      }
      if (req.method === 'GET' && url.pathname === '/api/logs') {
        return send(res, 200, {
          entries: logger.recent({
            level: url.searchParams.get('level') || 'debug',
            q: url.searchParams.get('q') || '',
            kind: url.searchParams.get('kind') || null,
            afterSeq: Number(url.searchParams.get('afterSeq') || 0),
            limit: Math.min(2000, Number(url.searchParams.get('limit') || 500)),
          }),
        });
      }
      if (req.method === 'GET' && url.pathname === '/api/logs/stream') return stream(req, res, logger);
      const users = /^\/api\/devices\/([^/]+)\/users(?:\/([^/]+))?$/.exec(url.pathname);
      if (users && deviceUsers) {
        const gateId = decodeURIComponent(users[1]);
        const userId = users[2] ? decodeURIComponent(users[2]) : null;
        if (req.method === 'GET' && !userId) return send(res, 200, await deviceUsers(gateId, url.searchParams.get('source') === 'device' ? 'list' : 'tracked'));
        if (req.method === 'GET') return send(res, 200, await deviceUsers(gateId, 'get', { userId }));
        if (req.method === 'PUT' && userId) return send(res, 200, await deviceUsers(gateId, 'set', { ...(await readJson(req)), userId }));
        if (req.method === 'DELETE' && userId) return send(res, 200, await deviceUsers(gateId, 'delete', { userId }));
      }
      return send(res, 404, { error: 'Bulunamadı.' });
    } catch (err) {
      return send(res, err.status && err.status < 500 ? err.status : 500, { error: err.message || String(err) });
    }
  });

  return {
    server,
    listen() {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve(server.address().port);
        });
      });
    },
    close() {
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

function stream(req, res, logger) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
  res.write(': ok\n\n');
  const unsubscribe = logger.subscribe((entry) => res.write(`data: ${JSON.stringify(entry)}\n\n`));
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(ping);
    unsubscribe();
  });
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJson(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('İstek çok büyük.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('Geçersiz JSON.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/** Cihaz parolalarını arayüze göndermez. */
function maskConfig(config) {
  const copy = structuredClone(config ?? {});
  for (const creds of Object.values(copy.credentials ?? {})) {
    if (creds && typeof creds === 'object' && creds.password) creds.password = MASK;
  }
  return copy;
}

/** Arayüzden "********" gelirse eski parola korunur. */
function unmaskConfig(next, current) {
  const copy = structuredClone(next ?? {});
  for (const [host, creds] of Object.entries(copy.credentials ?? {})) {
    if (creds && creds.password === MASK) creds.password = current?.credentials?.[host]?.password ?? '';
  }
  return copy;
}

module.exports = { createUiServer, maskConfig, unmaskConfig, MASK };
