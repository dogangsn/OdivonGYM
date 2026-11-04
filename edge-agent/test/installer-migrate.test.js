'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { migrate, MOVED_SUFFIX } = require('../installer/eski-kurulum');

function tempDirs(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'odivon-migrate-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const oldDir = path.join(root, 'Downloads', 'odivon-gym-edge-agent');
  const appDir = path.join(root, 'Odivon', 'EdgeAgent', 'app');
  fs.mkdirSync(path.join(oldDir, 'data'), { recursive: true });
  fs.mkdirSync(appDir, { recursive: true });
  return { oldDir, appDir };
}

test('eski elle kurulumun eşleştirmesi, kuyruğu ve cihaz ayarları yeni kuruluma taşınır', (t) => {
  const { oldDir, appDir } = tempDirs(t);
  const identity = { agentId: 'xcqHU0QQEAwFJU810NyS', token: 't', mainApiUrl: 'https://mainapi.odivon.com' };
  fs.writeFileSync(path.join(oldDir, 'data', 'identity.json'), JSON.stringify(identity));
  fs.writeFileSync(path.join(oldDir, 'data', 'agent.db'), 'db');
  fs.writeFileSync(path.join(oldDir, 'data', 'agent.db-wal'), 'wal');
  const config = {
    mainApiUrl: 'https://mainapi.odivon.com',
    dataDir: './data',
    credentials: { '192.168.1.202': { driver: 'zkemkeeper-com', skipHistory: true, useAgentClock: true, sdkBridgePath: 'C:\\eski\\kopru.exe' } },
  };
  fs.writeFileSync(path.join(oldDir, 'config.json'), `\uFEFF${JSON.stringify(config)}`);

  const result = migrate(oldDir, appDir);
  assert.deepEqual(result.copied, ['agent.db', 'agent.db-wal', 'config.json', 'identity.json']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(appDir, 'data', 'identity.json'), 'utf8')), identity);
  assert.equal(fs.readFileSync(path.join(appDir, 'data', 'agent.db-wal'), 'utf8'), 'wal');
  const moved = JSON.parse(fs.readFileSync(path.join(appDir, 'config.json'), 'utf8'));
  assert.equal(moved.dataDir, undefined, 'eski veri klasörü yolu taşınmaz');
  assert.deepEqual(moved.credentials['192.168.1.202'], { driver: 'zkemkeeper-com', skipHistory: true, useAgentClock: true });
  // Eski klasörde aynı kimlikle ikinci agent çalışamaz.
  assert.ok(!fs.existsSync(path.join(oldDir, 'data', 'identity.json')));
  assert.ok(fs.existsSync(path.join(oldDir, 'data', `identity.json${MOVED_SUFFIX}`)));

  // İkinci çalıştırma (sürüm yükseltme) hiçbir şeye dokunmaz.
  assert.equal(migrate(oldDir, appDir).skipped, 'bu kurulum zaten eşleşmiş');
});

test('eşleşmemiş eski kurulum ya da aynı klasör taşınmaz', (t) => {
  const { oldDir, appDir } = tempDirs(t);
  assert.equal(migrate(oldDir, appDir).skipped, 'eski kurulum eşleşmemiş');
  assert.ok(!fs.existsSync(path.join(appDir, 'config.json')));
  assert.equal(migrate(appDir, `${appDir}${path.sep}`).skipped, 'eski görev zaten bu kurulumu çalıştırıyor');
  assert.equal(migrate('', appDir).skipped, 'klasör verilmedi');
});

test('yeni kurulumda ayar dosyası varsa korunur', (t) => {
  const { oldDir, appDir } = tempDirs(t);
  fs.writeFileSync(path.join(oldDir, 'data', 'identity.json'), JSON.stringify({ agentId: 'a1', token: 't' }));
  fs.writeFileSync(path.join(oldDir, 'config.json'), JSON.stringify({ credentials: { x: { password: 'eski' } } }));
  fs.writeFileSync(path.join(appDir, 'config.json'), JSON.stringify({ credentials: { x: { password: 'yeni' } } }));
  assert.deepEqual(migrate(oldDir, appDir).copied, ['identity.json']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(appDir, 'config.json'), 'utf8')).credentials.x.password, 'yeni');
});
