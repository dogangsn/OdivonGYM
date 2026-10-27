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
const readline = require('node:readline');
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
    // Yeni geçişler bu kadar toplanıp gönderilir; olay yoksa istek atılmaz.
    eventFlushDelayMs: Math.max(2, config.eventFlushDelaySeconds ?? 5) * 1000,
    // Gönderilemeyen olaylar için yedek periyodik deneme (en çok 10 dk).
    eventFlushIntervalMs: Math.min(600, Math.max(60, config.eventFlushIntervalSeconds ?? 600)) * 1000,
    // MainApi her heartbeat'te yazma yapar; 60 sn'den sık gönderilmez.
    heartbeatIntervalMs: Math.max(60, config.heartbeatIntervalSeconds ?? 60) * 1000,
    dataDir: path.resolve(ROOT, config.dataDir || './data'),
  };
}

function identityPath(config) {
  return path.join(config.dataDir, 'identity.json');
}

/** Kod ile MainApi'ye kaydolur ve kimliği diske yazar. Hata olursa fırlatır. */
async function enrollWithCode(config, code) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const result = await MainApiClient.enroll({
    baseUrl: config.mainApiUrl,
    code: String(code).trim().toUpperCase(),
    name: config.agentName,
    hostname: os.hostname(),
    agentVersion: AGENT_VERSION,
  });
  const identity = { agentId: result.agentId, token: result.token, tenantId: result.tenantId, mainApiUrl: config.mainApiUrl };
  fs.writeFileSync(identityPath(config), JSON.stringify(identity, null, 2), { encoding: 'utf8', mode: 0o600 });
  console.log(`✅ Agent eşleştirildi (${result.agentId}). ${result.gateIds?.length ?? 0} cihaz atandı.`);
  return identity;
}

async function enroll(config, code) {
  if (!code) fail('Kullanım: npm run enroll -- EŞLEŞTİRME_KODU');
  await enrollWithCode(config, code).catch((err) => fail(`Eşleştirme başarısız: ${err.message}`));
  console.log('👉 Şimdi `npm start` ile başlatın.');
}

/** Pencerede çalışıyorsa koddan sorar; arka planda çalışıyorsa agent klasörüne konan kod dosyasını bekler. */
const CODE_FILE = path.join(ROOT, 'eslestirme-kodu.txt');

function askLine(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

async function waitForCodeFile() {
  for (;;) {
    try {
      const code = fs.readFileSync(CODE_FILE, 'utf8').trim();
      fs.rmSync(CODE_FILE, { force: true });
      if (code) return code;
    } catch {
      /* dosya henüz yok */
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}

/** Geçerli bir kod girilene kadar sorar ve eşleştirir. */
async function pairInteractively(config) {
  const interactive = Boolean(process.stdin.isTTY);
  if (!interactive) {
    console.log(`👉 Admin panelinden yeni eşleştirme kodu alın ve "${CODE_FILE}" dosyasına yazıp kaydedin; agent kendisi eşleşecek.`);
  }
  for (;;) {
    const code = interactive ? await askLine('🔑 Admin panelindeki yeni eşleştirme kodunu girin: ') : await waitForCodeFile();
    if (!code.trim()) continue;
    try {
      return await enrollWithCode(config, code);
    } catch (err) {
      const hint = err.status
        ? 'Kod 10 dk geçerli ve tek kullanımlık; panelden yeni kod alıp tekrar deneyin.'
        : 'MainApi\'ye ulaşılamadı; internet bağlantısını kontrol edip kodu tekrar girin.';
      console.error(`❌ Eşleştirme başarısız: ${err.message}. ${hint}`);
    }
  }
}

function clientFor(config, identity) {
  return new MainApiClient({
    baseUrl: identity.mainApiUrl || config.mainApiUrl,
    agentId: identity.agentId,
    token: identity.token,
  });
}

async function run(config) {
  const file = identityPath(config);
  let identity;
  if (fs.existsSync(file)) {
    identity = JSON.parse(fs.readFileSync(file, 'utf8'));
  } else {
    console.log('ℹ️ Agent henüz eşleştirilmemiş.');
    identity = await pairInteractively(config);
  }
  const client = clientFor(config, identity);
  const store = new Store(path.join(config.dataDir, 'agent.db'));
  const runtime = new AgentRuntime({
    client,
    store,
    credentials: config.credentials,
    agentVersion: AGENT_VERSION,
    logger: console,
    flushOnTick: false,
    eventFlushDelayMs: config.eventFlushDelayMs,
    // Kimlik reddedilirse (iptal / başka kopyayla yeniden eşleştirme) yeni kod sorulur ve kaldığı yerden devam edilir.
    onRevoked: async () => {
      const next = await pairInteractively(config);
      runtime.resume(clientFor(config, next));
      console.log(`🆔 Yeni agent kimliği: ${next.agentId}. Çalışmaya devam ediliyor.`);
    },
  });

  console.log('====================================================');
  console.log(`   ODIVON GYM EDGE AGENT v${AGENT_VERSION}`);
  console.log('====================================================');
  console.log(`🆔 Agent            : ${identity.agentId}`);
  console.log(`🌐 MainApi          : ${client.baseUrl}`);
  console.log(`⏱️ Cihaz Tarama    : ${config.pollIntervalMs / 1000} sn`);
  console.log(`⏱️ İş Sorgusu      : sunucu önerisiyle (boştayken 30 sn)`);
  console.log(`📤 Geçiş Gönderimi  : yeni geçişten ${config.eventFlushDelayMs / 1000} sn sonra`);
  console.log(`💓 Heartbeat        : ${config.heartbeatIntervalMs / 1000} sn`);
  console.log(`📦 Bekleyen olay    : ${store.queueDepth()}`);
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
    loop(config.eventFlushIntervalMs, () => runtime.flushEvents()),
    loop(config.heartbeatIntervalMs, () => runtime.heartbeat()),
    setInterval(() => store.prune(), 6 * 60 * 60 * 1000),
  ];

  const shutdown = async () => {
    console.log('\n🛑 Edge Agent kapatılıyor...');
    timers.forEach(clearInterval);
    try {
      await runtime.flushEvents();
    } catch {}
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
