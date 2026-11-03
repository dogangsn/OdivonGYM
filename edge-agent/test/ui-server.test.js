'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Logger } = require('../src/logger');
const { createUiServer, MASK } = require('../src/ui-server');

const quiet = { log() {}, warn() {}, error() {} };

test('logger dosyaya yazar, döndürür ve filtreler', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'odivon-log-'));
  const log = new Logger({ dir, maxBytes: 200, keepFiles: 2, console: quiet });
  for (let i = 0; i < 10; i++) log.info(`satır ${i} ${'x'.repeat(30)}`);
  log.warn('cihaz koptu');
  log.event('pass', '🪪 üye 14441', { gateId: 'g1' });
  assert.ok(fs.existsSync(path.join(dir, 'agent.log')));
  assert.ok(fs.existsSync(path.join(dir, 'agent.log.1')));
  assert.ok(!fs.existsSync(path.join(dir, 'agent.log.3')));
  assert.deepEqual(log.recent({ level: 'warn' }).map((e) => e.message), ['cihaz koptu']);
  assert.deepEqual(log.recent({ kind: 'pass' }).map((e) => e.gateId), ['g1']);
  assert.equal(log.recent({ q: 'KOPTU' }).length, 1);
});


test('arayüz yalnızca localhost Host başlığını kabul eder ve parolayı gizler', async (t) => {
  // createUiServer izinli Host listesini verilen porttan kurar; testte gerçek portla yeniden oluştur
  const log = new Logger({ console: quiet });
  let config = { credentials: { '192.168.1.4': { username: 'admin', password: 'gizli' } } };
  const probe = createUiServer({ port: 0, logger: log, getStatus: async () => ({}), pair: async () => ({}), readConfig: () => config, writeConfig: async () => {} });
  await probe.listen();
  const port = probe.server.address().port;
  await probe.close();
  const ui = createUiServer({
    port,
    logger: log,
    getStatus: async () => ({ paired: false }),
    pair: async (code) => ({ agentId: `a-${code}`, gateCount: 1 }),
    readConfig: () => config,
    writeConfig: async (next) => {
      config = next;
    },
  });
  await ui.listen();
  t.after(() => ui.close());
  const base = `http://127.0.0.1:${port}`;

  const cfg = await (await fetch(`${base}/api/config`)).json();
  assert.equal(cfg.credentials['192.168.1.4'].password, MASK);

  // Maskeli parola geri gelirse eskisi korunur
  cfg.credentials['192.168.1.4'].timeoutMs = 7000;
  const put = await fetch(`${base}/api/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
  assert.equal(put.status, 200);
  assert.equal(config.credentials['192.168.1.4'].password, 'gizli');
  assert.equal(config.credentials['192.168.1.4'].timeoutMs, 7000);

  // JSON olmayan değiştirici istek (başka sitenin form gönderimi) reddedilir
  const form = await fetch(`${base}/api/pair`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{"code":"X"}' });
  assert.equal(form.status, 415);
  const foreign = await fetch(`${base}/api/pair`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{"code":"X"}' });
  assert.equal(foreign.status, 403);
  const ok = await (await fetch(`${base}/api/pair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"code":"ABCD2345"}' })).json();
  assert.equal(ok.agentId, 'a-ABCD2345');

  const html = await fetch(`${base}/`);
  assert.equal(html.status, 200);
  assert.match(await html.text(), /Odivon Edge Agent/);
});
