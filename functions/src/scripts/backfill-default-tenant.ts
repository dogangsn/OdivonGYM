/**
 * TEK SEFERLİK migration script'i — çok kiracılı modele geçmeden ÖNCE var
 * olan (tenantId'siz) `users/{uid}` dokümanlarını tek bir "varsayılan
 * tenant"a bağlar ve custom claims'i (`role`, `tenantId`) geriye dönük set
 * eder. Bir Cloud Function DEĞİLDİR — `functions/src/index.ts`'e export
 * edilmez, deploy edilmez; yalnızca elle, bir kere çalıştırılır.
 *
 * Idempotent: `tenantId`'si zaten olan dokümanlara dokunmaz, tekrar
 * çalıştırmak güvenlidir.
 *
 * Kullanım:
 *   cd functions
 *   npm run build
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *     node lib/scripts/backfill-default-tenant.js --dry-run   # önce önizle
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *     node lib/scripts/backfill-default-tenant.js             # gerçekten uygula
 *
 * Service account key: Firebase Console → Project Settings → Service
 * Accounts → "Generate new private key". Bu dosyayı asla commit etme.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, QueryDocumentSnapshot } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');
const DEFAULT_TENANT_NAME = process.env['DEFAULT_TENANT_NAME'] ?? 'OdivonGYM';
const DEFAULT_TENANT_SLUG = 'odivongym-default';

initializeApp();
const db = getFirestore();
const auth = getAuth();

async function findOrCreateDefaultTenant(): Promise<string> {
  const existing = await db.collection('tenants').where('slug', '==', DEFAULT_TENANT_SLUG).limit(1).get();
  if (!existing.empty) {
    const id = existing.docs[0].id;
    console.log(`[backfill] Varsayılan tenant zaten var: ${id} (${DEFAULT_TENANT_NAME})`);
    return id;
  }

  if (DRY_RUN) {
    console.log(`[backfill] (dry-run) '${DEFAULT_TENANT_NAME}' adında yeni tenant oluşturulacaktı.`);
    return '<dry-run-tenant-id>';
  }

  const ref = db.collection('tenants').doc();
  await ref.set({
    name: DEFAULT_TENANT_NAME,
    slug: DEFAULT_TENANT_SLUG,
    createdAt: Timestamp.now(),
  });
  console.log(`[backfill] Yeni varsayılan tenant oluşturuldu: ${ref.id} (${DEFAULT_TENANT_NAME})`);
  return ref.id;
}

async function main(): Promise<void> {
  console.log(`[backfill] Başlıyor${DRY_RUN ? ' (DRY RUN — hiçbir şey yazılmayacak)' : ''}…`);

  const tenantId = await findOrCreateDefaultTenant();

  const usersSnap = await db.collection('users').get();
  const toMigrate = usersSnap.docs.filter((d: QueryDocumentSnapshot) => !d.data()['tenantId']);

  if (toMigrate.length === 0) {
    console.log('[backfill] Taşınacak kullanıcı yok — herkeste zaten tenantId var.');
    return;
  }

  console.log(`[backfill] ${toMigrate.length} kullanıcı '${tenantId}' tenant'ına taşınacak.`);

  // Firestore batch limiti 500 — 400'lük gruplar halinde ilerle.
  const chunkSize = 400;
  for (let i = 0; i < toMigrate.length; i += chunkSize) {
    const chunk = toMigrate.slice(i, i + chunkSize);

    if (!DRY_RUN) {
      const batch = db.batch();
      for (const docSnap of chunk) {
        batch.update(docSnap.ref, { tenantId, updatedAt: Timestamp.now() });
      }
      await batch.commit();
    }

    for (const docSnap of chunk) {
      const uid = docSnap.id;
      const role = (docSnap.data()['role'] as string) ?? 'user';
      console.log(`[backfill] ${DRY_RUN ? '(dry-run) ' : ''}${uid} → tenantId=${tenantId}, role=${role}`);

      if (!DRY_RUN) {
        try {
          await auth.setCustomUserClaims(uid, { role, tenantId });
        } catch (error) {
          // Auth kullanıcısı silinmiş ama Firestore dokümanı kalmış olabilir
          // — Firestore güncellemesi zaten yapıldı, sadece logla ve devam et.
          console.error(`[backfill] UYARI: ${uid} için custom claims set edilemedi:`, error);
        }
      }
    }
  }

  console.log(`[backfill] Tamamlandı${DRY_RUN ? ' (dry-run — hiçbir şey değişmedi)' : ''}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[backfill] Beklenmeyen hata:', error);
    process.exit(1);
  });
