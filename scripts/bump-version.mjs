import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const pkgUrl = new URL('package.json', root);
const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8'));

// Semver x.y.z formatını ayrıştır
const semver = pkg.version.split('.').map(Number);
if (semver.length === 3 && !semver.some(isNaN)) {
  const oldVersion = pkg.version;
  semver[2] += 1; // Patch sürümünü otomatik 1 artır
  const newVersion = semver.join('.');
  pkg.version = newVersion;
  writeFileSync(pkgUrl, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`\n🚀 [Auto-Version Hook] Sürüm otomatik güncellendi: v${oldVersion} ➔ v${newVersion}`);

  // package-lock.json varsa onu da eşitle
  try {
    const lockUrl = new URL('package-lock.json', root);
    const lock = JSON.parse(readFileSync(lockUrl, 'utf8'));
    lock.version = newVersion;
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = newVersion;
    }
    writeFileSync(lockUrl, JSON.stringify(lock, null, 2) + '\n');
  } catch {}

  // build-info.generated.ts ve public/version.json dosyalarını yeni sürümle üret
  try {
    execSync('node scripts/write-version.mjs', { cwd: root, stdio: 'inherit' });
  } catch (err) {
    console.error('write-version hatası:', err);
  }

  // Değişen versiyon dosyalarını doğrudan bu commit'e ekle (stage)
  try {
    execSync('git add package.json package-lock.json', { cwd: root });
  } catch {}
}
