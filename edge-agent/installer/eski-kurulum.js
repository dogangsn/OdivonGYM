'use strict';

/**
 * Elle kurulmuş eski agent'ın (ör. Downloads klasörü, servis-kur.bat) eşleştirmesini, kuyruğunu
 * ve cihaz ayarlarını yeni kuruluma taşır: yeniden eşleştirmek ve ayarları tekrar girmek gerekmez.
 * Kurulum programı gorev.ps1 üzerinden, eski görevin çalışma klasörüyle çağırır:
 *
 *   node eski-kurulum.js "<eski klasör>" "<yeni app klasörü>"
 *
 * Eski klasördeki kimlik dosyası yeniden adlandırılır: oradaki baslat.bat yanlışlıkla açılırsa
 * aynı kimlikle ikinci bir agent çalışmasın (ZK cihazı tek bağlantı kabul eder).
 */

const fs = require('node:fs');
const path = require('node:path');

const DB_FILES = ['agent.db', 'agent.db-wal', 'agent.db-shm'];
const MOVED_SUFFIX = '.yeni-kuruluma-tasindi';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch {
    return null;
  }
}

function sameDir(a, b) {
  return path.resolve(a).replace(/[\\/]+$/, '').toLowerCase() === path.resolve(b).replace(/[\\/]+$/, '').toLowerCase();
}

function migrate(oldDir, appDir) {
  if (!oldDir || !appDir) return { skipped: 'klasör verilmedi' };
  if (sameDir(oldDir, appDir)) return { skipped: 'eski görev zaten bu kurulumu çalıştırıyor' };
  const newData = path.join(appDir, 'data');
  if (fs.existsSync(path.join(newData, 'identity.json'))) return { skipped: 'bu kurulum zaten eşleşmiş' };

  const oldConfig = readJson(path.join(oldDir, 'config.json'));
  const oldData = path.resolve(oldDir, oldConfig?.dataDir || './data');
  const oldIdentity = path.join(oldData, 'identity.json');
  if (!readJson(oldIdentity)?.agentId) return { skipped: 'eski kurulum eşleşmemiş' };

  fs.mkdirSync(newData, { recursive: true });
  const copied = [];
  for (const name of DB_FILES) {
    const from = path.join(oldData, name);
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, path.join(newData, name));
      copied.push(name);
    }
  }

  const newConfig = path.join(appDir, 'config.json');
  if (oldConfig && !fs.existsSync(newConfig)) {
    // Eski klasöre bağlı yollar taşınmaz: veri ve ZK köprüsü yeni kurulumdakiler kullanılır.
    delete oldConfig.dataDir;
    for (const creds of Object.values(oldConfig.credentials ?? {})) {
      if (creds && typeof creds === 'object') delete creds.sdkBridgePath;
    }
    fs.writeFileSync(newConfig, `${JSON.stringify(oldConfig, null, 2)}\n`, 'utf8');
    copied.push('config.json');
  }

  // Kimlik en son yazılır: yarıda kalan bir taşıma "eşleşmiş" görünmesin.
  fs.copyFileSync(oldIdentity, path.join(newData, 'identity.json'));
  copied.push('identity.json');
  try {
    fs.renameSync(oldIdentity, `${oldIdentity}${MOVED_SUFFIX}`);
  } catch {
    /* eski klasör salt okunur olabilir; yeni kurulum yine çalışır */
  }
  return { copied, from: oldDir };
}

if (require.main === module) {
  const [oldDir, appDir] = process.argv.slice(2);
  try {
    const result = migrate(oldDir, appDir);
    console.log(result.skipped ? `Eski kurulum taşınmadı: ${result.skipped}` : `Eski kurulumdan taşındı (${result.from}): ${result.copied.join(', ')}`);
  } catch (err) {
    // Taşıma başarısız olsa da kurulum sürer; agent arayüzden eşleştirilebilir.
    console.error(`Eski kurulum taşınamadı: ${err.message}`);
  }
}

module.exports = { migrate, MOVED_SUFFIX };
