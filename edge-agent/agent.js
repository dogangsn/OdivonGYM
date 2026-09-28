'use strict';

/**
 * OdivonGYM Edge Agent v2
 *
 * Salondaki cihazlarla yerel ağda konuşur, MainApi'ye yalnızca giden HTTPS ile
 * bağlanır. Firebase'e bağlanmaz. Sözleşme: ../docs/access-agent-contract.md
 *
 *   npm run enroll -- KOD   → admin panelindeki eşleştirme koduyla kaydol
 *   npm start               → çalıştır
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MainApiClient } = require('./src/mainapi-client');
const { Store } = require('./src/store');
const { AgentRuntime } = require('./src/runtime');

const AGENT_VERSION = require('./package.json').version;
const ROOT = __dirname;
const DEFAULT_API = 'https://mainapi.odivon.com/api/v1';

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function loadConfig() {
  const file = path.join(ROOT, 'config.json');
  if (!fs.existsSync(file)) {
    fail('config.json bulunamadı. config.sample.json dosyasını config.json olarak kopyalayıp düzenleyin.');
  }
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    mainApiUrl: config.mainApiUrl || DEFAULT_API,
    agentName: config.agentName || os.hostname(),
    credentials: config.credentials || {},
    pollIntervalMs: Math.max(2, config.pollIntervalSeconds ?? 5) * 1000,
    heartbeatIntervalMs: Math.max(5, config.heartbeatIntervalSeconds ?? 15) * 1000,
    dataDir: path.resolve(ROOT, config.dataDir || './data'),
  };
}

function identityPath(config) {
  return path.join(config.dataDir, 'identity.json');
}

async function enroll(config, code) {
  if (!code) fail('Kullanım: npm run enroll -- EŞLEŞTİRME_KODU');
  fs.mkdirSync(config.dataDir, { recursive: true });
  const result = await MainApiClient.enroll({
    baseUrl: config.mainApiUrl,
    code: code.trim().toUpperCase(),
    name: config.agentName,
    hostname: os.hostname(),
    agentVersion: AGENT_VERSION,
  }).catch((err) => fail(`Eşleştirme başarısız: ${err.message}`));
  fs.writeFileSync(
    identityPath(config),
    JSON.stringify({ agentId: result.agentId, token: result.token, tenantId: result.tenantId, mainApiUrl: config.mainApiUrl }, null, 2),
    { encoding: 'utf8', mode: 0o600 },
  );
  console.log(`✅ Agent eşleştirildi (${result.agentId}). ${result.gateIds?.length ?? 0} cihaz atandı.`);
  console.log('👉 Şimdi `npm start` ile başlatın.');
}

async function run(config) {
  const file = identityPath(config);
  if (!fs.existsSync(file)) {
    fail('Agent henüz eşleştirilmemiş. Admin panelinden eşleştirme kodu alıp `npm run enroll -- KOD` çalıştırın.');
  }
  const identity = JSON.parse(fs.readFileSync(file, 'utf8'));
  const client = new MainApiClient({
    baseUrl: identity.mainApiUrl || config.mainApiUrl,
    agentId: identity.agentId,
    token: identity.token,
  });
  const store = new Store(path.join(config.dataDir, 'agent.db'));
  const runtime = new AgentRuntime({
    client,
    store,
    credentials: config.credentials,
    agentVersion: AGENT_VERSION,
    logger: console,
  });

  console.log('====================================================');
  console.log(`   ODIVON GYM EDGE AGENT v${AGENT_VERSION}`);
  console.log('====================================================');
  console.log(`🆔 Agent        : ${identity.agentId}`);
  console.log(`🌐 MainApi      : ${client.baseUrl}`);
  console.log(`⏱️ Tarama        : ${config.pollIntervalMs / 1000} sn`);
  console.log(`📦 Bekleyen olay: ${store.queueDepth()}`);
  console.log('----------------------------------------------------');

  const loop = (intervalMs, fn) => {
    let running = false;
    const tick = async () => {
      if (running || runtime.stopped) return;
      running = true;
      try {
        await fn();
      } catch (err) {
        console.error('❌ Beklenmeyen hata:', err);
      } finally {
        running = false;
      }
    };
    tick();
    return setInterval(tick, intervalMs);
  };

  const timers = [
    loop(config.pollIntervalMs, () => runtime.tick()),
    loop(config.heartbeatIntervalMs, () => runtime.heartbeat()),
    setInterval(() => store.prune(), 6 * 60 * 60 * 1000),
  ];

  const shutdown = () => {
    console.log('\n🛑 Edge Agent kapatılıyor...');
    timers.forEach(clearInterval);
    runtime.stop();
    store.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const [command, arg] = process.argv.slice(2);
const config = loadConfig();
if (command === 'enroll') enroll(config, arg);
else run(config);
