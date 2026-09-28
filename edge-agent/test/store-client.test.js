'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Store } = require('../src/store');
const { MainApiClient } = require('../src/mainapi-client');
const { toIstanbulIso } = require('../src/time');

test('store aynı olayı iki kez kuyruğa almaz ve imleci birlikte yazar', () => {
  const store = new Store(':memory:');
  const ev = { eventId: 'yt-1', userId: '1', time: '2026-09-28T21:00:00+03:00' };
  assert.equal(store.enqueueEvents('g1', [ev], { total: 1, page: 1 }), 1);
  assert.equal(store.enqueueEvents('g1', [ev], { total: 1, page: 1 }), 0);
  assert.equal(store.enqueueEvents('g2', [ev]), 1, 'farklı cihazın aynı kimliği ayrı olaydır');
  assert.deepEqual(store.getCursor('g1'), { total: 1, page: 1 });
  const batch = store.peekEvents(10);
  assert.equal(batch.length, 2);
  store.deleteEvents(batch.map((b) => b.rowId));
  assert.equal(store.queueDepth(), 0);
  assert.equal(store.enqueueEvents('g1', [ev]), 0, 'gönderildikten sonra da tekrar alınmaz');
  store.close();
});

test('saatler Türkiye saat dilimiyle ISO olur', () => {
  assert.equal(toIstanbulIso('2026-09-28 21:14:05'), '2026-09-28T21:14:05+03:00');
  assert.equal(toIstanbulIso('20260928211405'), '2026-09-28T21:14:05+03:00');
  assert.equal(toIstanbulIso('2026-09-28T18:14:05Z'), '2026-09-28T18:14:05.000Z');
  assert.equal(toIstanbulIso('bozuk'), null);
});

test('MainApi istemcisi agent kimliği gönderir, zarfı açar, 401 için auth hatası verir', async (t) => {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push({ method: req.method, url: req.url, auth: req.headers.authorization });
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/api/v1/gym/access/agents/heartbeat')) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'revoked' } }));
    }
    res.end(JSON.stringify({ success: true, data: { devices: [], items: [] } }));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const client = new MainApiClient({ baseUrl: `http://127.0.0.1:${server.address().port}/api/v1/`, agentId: 'a1', token: 'tok' });
  assert.deepEqual(await client.getWork(), { devices: [], items: [] });
  assert.equal(seen[0].auth, 'Agent a1.tok');
  assert.equal(seen[0].url, '/api/v1/gym/access/agents/work?limit=50');
  await assert.rejects(client.heartbeat({}), (err) => err.isAuthError && err.code === 'UNAUTHORIZED');
});
