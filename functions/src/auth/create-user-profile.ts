import * as functionsV1 from 'firebase-functions/v1';
import { logger } from 'firebase-functions';
import { db } from '../firebase-admin';

/**
 * Yeni bir Firebase Auth kullanıcısı oluşturulduğunda tetiklenir. Çok
 * kiracılı modelde `users/{uid}` dokümanının TEK otoriter kaynağı artık
 * `createTenantWithAdmin`, `createTenantMember` ve `ensureTenantForGoogleUser`
 * callable'larıdır (bkz. `functions/src/tenant/*`) — her biri Firestore
 * dokümanını KENDİ yazar ve rol/tenantId custom claim'lerini kendisi set
 * eder, çünkü hangi tenant'a ait olacağı ve hangi rolü alacağı bu
 * fonksiyonların iş mantığına bağlıdır (bu tetikleyici bunu bilemez).
 *
 * Bu yüzden burası artık sadece bir gözlem noktası: yukarıdaki callable'lar
 * dışında (örn. Firebase Console'dan elle) oluşturulmuş, dokümansız bir Auth
 * kullanıcısı varsa bunu loglar — otomatik olarak tenant'sız bir profil
 * OLUŞTURMAZ, çünkü `role`/`tenantId` olmayan bir `users/{uid}` dokümanı
 * `firestore.rules`'daki hiçbir izolasyon kontrolünü geçemeyip kullanıcıyı
 * kilitli bırakır ve buna rağmen sahte bir güvenlik boşluğu izlenimi verir.
 */
export const createUserProfile = functionsV1.auth.user().onCreate(async (user) => {
  const existing = await db.collection('users').doc(user.uid).get();
  if (existing.exists) {
    return;
  }
  logger.warn(
    `users/${user.uid} için doküman yok ve tenant-bootstrap callable'larından geçmemiş ` +
      `(muhtemelen Console'dan elle oluşturuldu). Otomatik profil oluşturulmadı — ` +
      `bkz. functions/src/tenant/create-tenant-with-admin.ts.`,
  );
});
