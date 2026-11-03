'use strict';

/**
 * OdivonGYM Edge Agent v2
 *
 * Salondaki cihazlarla yerel ağda konuşur, MainApi'ye yalnızca giden HTTPS ile
 * bağlanır. Firebase'e bağlanmaz. Sözleşme: ../docs/access-agent-contract.md
 *
 * Yönetim arayüzü: http://127.0.0.1:47800 (yalnızca bu bilgisayardan).
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
const { Logger } = require('./src/logger');
const { createUiServer } = require('./src/ui-server');

const AGENT_VERSION = require('./package.json').version;
const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, 'config.json');
const SAMPLE_CONFIG_FILE = path.join(ROOT, 'config.sample.json');
const DEFAULT_API = 'https://mainapi.odivon.com/api/v1';
const DEFAULT_UI_PORT = 47800;

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

/** config.json yoksa (yeni kurulum) boş bir ayar dosyası oluşturulur; cihazlar arayüzden eklenir. */
function readRawConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    const initial = { mainApiUrl: DEFAULT_API, agentName: os.hostname(), credentials: {} };
    fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(initial, null, 2)}\n`, 'utf8');
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8').replace(/^﻿/, ''));
}

function writeRawConfig(config) {
  const tmp = `${CONFIG_FILE}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, CONFIG_FILE);
}

function normalizeConfig(config) {
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
    uiPort: Number(config.uiPort ?? DEFAULT_UI_PORT),
    uiEnabled: config.uiEnabled !== false,
  };
}

function identityPath(config) {
  return path.join(config.dataDir, 'identity.json');
}

function readIdentity(config) {
  const file = identityPath(config);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Kod ile MainApi'ye kaydolur ve kimliği diske yazar. Hata olursa fırlatır. */
async function enrollWithCode(config, code, log = console) {
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
  log.info(`✅ Agent eşleştirildi (${result.agentId}). ${result.gateIds?.length ?? 0} cihaz atandı.`);
  return { identity, gateCount: result.gateIds?.length ?? 0 };
}

async function enroll(config, code) {
  if (!code) fail('Kullanım: npm run enroll -- EŞLEŞTİRME_KODU');
  await enrollWithCode(config, code).catch((err) => fail(`Eşleştirme başarısız: ${err.message}`));
  console.log('👉 Agent başlatılmaya hazır.');
}

const CODE_FILE = path.join(ROOT, 'eslestirme-kodu.txt');

function pairingHint(err) {
  return err.status
    ? 'Kod 10 dk geçerli ve tek kullanımlık; panelden yeni kod alıp tekrar deneyin.'
    : "MainApi'ye ulaşılamadı; internet bağlantısını kontrol edip kodu tekrar girin.";
}

function clientFor(config, identity) {
  return new MainApiClient({
    baseUrl: identity.mainApiUrl || config.mainApiUrl,
    agentId: identity.agentId,
    token: identity.token,
  });
}

async function run() {
  let config = normalizeConfig(readRawConfig());
  fs.mkdirSync(config.dataDir, { recursive: true });
  const log = new Logger({ dir: path.join(config.dataDir, 'logs') });
  const store = new Store(path.join(config.dataDir, 'agent.db'));

  let identity = readIdentity(config);
  let runtime = null;
  let pairingWaiter = null; // eşleşme beklenirken arayüz / dosya / pencereden gelen kodu bekler

  const startedAt = new Date().toISOString();

  /** Eşleşme: arayüzden, pencereden veya eslestirme-kodu.txt dosyasından gelen kod. */
  async function pairWithCode(code) {
    const trimmed = String(code || '').trim();
    if (!trimmed) throw Object.assign(new Error('Eşleştirme kodu boş.'), { status: 400 });
    try {
      const result = await enrollWithCode(config, trimmed, log);
      identity = result.identity;
      if (runtime) {
        runtime.resume(clientFor(config, identity));
        log.info(`🆔 Yeni agent kimliği: ${identity.agentId}. Çalışmaya devam ediliyor.`);
      }
      pairingWaiter?.resolve(identity);
      pairingWaiter = null;
      return { agentId: identity.agentId, gateCount: result.gateCount };
    } catch (err) {
      log.error(`❌ Eşleştirme başarısız: ${err.message}. ${pairingHint(err)}`);
      throw Object.assign(new Error(`${err.message}. ${pairingHint(err)}`), { status: err.status ? 400 : 502 });
    }
  }

  function waitForPairing() {
    if (pairingWaiter) return pairingWaiter.promise;
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    pairingWaiter = { promise, resolve };
    const ui = config.uiEnabled ? ` veya yönetim arayüzüne (http://127.0.0.1:${config.uiPort}) girin` : '';
    log.info(`👉 Admin panelinden eşleştirme kodu alın ve "${CODE_FILE}" dosyasına yazın${ui}.`);
    if (process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ask = () =>
        rl.question('🔑 Admin panelindeki eşleştirme kodunu girin: ', (answer) => {
          if (!pairingWaiter) return rl.close();
          pairWithCode(answer).then(() => rl.close(), () => ask());
        });
      ask();
    }
    const timer = setInterval(() => {
      if (!pairingWaiter) return clearInterval(timer);
      let code = '';
      try {
        code = fs.readFileSync(CODE_FILE, 'utf8').trim();
        fs.rmSync(CODE_FILE, { force: true });
      } catch {
        return;
      }
      if (code) pairWithCode(code).catch(() => undefined);
    }, 10000);
    return promise;
  }

  if (config.uiEnabled) {
    const ui = createUiServer({
      port: config.uiPort,
      logger: log,
      pair: pairWithCode,
      readConfig: readRawConfig,
      writeConfig: async (next) => {
        writeRawConfig(next);
        config = { ...normalizeConfig(next), dataDir: config.dataDir, uiPort: config.uiPort };
        runtime?.updateCredentials(config.credentials);
        log.info('⚙️ Ayarlar kaydedildi; cihaz bağlantıları yeni ayarlarla yeniden kuruluyor.');
      },
      getStatus: async () => ({
        agentVersion: AGENT_VERSION,
        startedAt,
        hostname: os.hostname(),
        paired: Boolean(identity) && !(runtime?.revoked ?? false),
        agentId: identity?.agentId ?? null,
        mainApiUrl: identity?.mainApiUrl || config.mainApiUrl,
        waitingForPairing: Boolean(pairingWaiter),
        ...(runtime ? runtime.snapshot() : { queueDepth: store.queueDepth(), devices: [], recentPasses: [] }),
      }),
    });
    await ui
      .listen()
      .then((port) => log.info(`🖥️ Yönetim arayüzü: http://127.0.0.1:${port}`))
      .catch((err) => log.warn(`⚠️ Yönetim arayüzü açılamadı (port ${config.uiPort}): ${err.message}`));
  }

  if (!identity) {
    log.info('ℹ️ Agent henüz eşleştirilmemiş.');
    identity = await waitForPairing();
  }

  runtime = new AgentRuntime({
    client: clientFor(config, identity),
    store,
    credentials: config.credentials,
    agentVersion: AGENT_VERSION,
    logger: log,
    flushOnTick: false,
    eventFlushDelayMs: config.eventFlushDelayMs,
    // Kimlik reddedilirse (iptal / başka kopyayla yeniden eşleştirme) yeni kod beklenir ve kaldığı yerden devam edilir.
    onRevoked: async () => {
      await waitForPairing();
    },
  });

  log.info('====================================================');
  log.info(`   ODIVON GYM EDGE AGENT v${AGENT_VERSION}`);
  log.info('====================================================');
  log.info(`🆔 Agent            : ${identity.agentId}`);
  log.info(`🌐 MainApi          : ${identity.mainApiUrl || config.mainApiUrl}`);
  log.info(`⏱️ Cihaz Tarama    : ${config.pollIntervalMs / 1000} sn`);
  log.info('⏱️ İş Sorgusu      : sunucu önerisiyle (boştayken 30 sn)');
  log.info(`📤 Geçiş Gönderimi  : yeni geçişten ${config.eventFlushDelayMs / 1000} sn sonra`);
  log.info(`💓 Heartbeat        : ${config.heartbeatIntervalMs / 1000} sn`);
  log.info(`📦 Bekleyen olay    : ${store.queueDepth()}`);
  log.info('----------------------------------------------------');

  const loop = (intervalMs, fn) => {
    let running = false;
    const tick = async () => {
      if (running || runtime.stopped) return;
      running = true;
      try {
        await fn();
      } catch (err) {
        log.error('❌ Beklenmeyen hata:', err);
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
    log.info('🛑 Edge Agent kapatılıyor...');
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
if (command === 'enroll') enroll(normalizeConfig(readRawConfig()), arg);
else run().catch((err) => fail(err.stack || err.message));
