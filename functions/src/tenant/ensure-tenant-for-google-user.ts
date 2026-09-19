import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import { db, TRIAL_DURATION_DAYS } from '../firebase-admin';
import { slugify } from './slugify';

interface EnsureTenantForGoogleUserInput {
  displayName: string | null;
  photoURL: string | null;
}

/**
 * Google ile giriş, Auth kullanıcısını client SDK üzerinden (Admin SDK'nın
 * dışında) oluşturur — bu yüzden Kural 1'i email/şifre kaydıyla aynı Function
 * içinde uygulayamayız. Bunun yerine client, `signInWithPopup` sonrasında bu
 * callable'ı çağırır:
 *
 *  - `users/{uid}` zaten varsa (daha önce kaydolmuş kullanıcı) → dokunmadan
 *    mevcut `tenantId`'yi döner.
 *  - Yoksa (bu kimliğin sistemdeki İLK görünüşü) → Kural 1 uygulanır: yeni
 *    bir tenant + admin profili oluşturulur, custom claims set edilir.
 *
 * `uid`/`email` HER ZAMAN `request.auth`'tan okunur, `request.data`'dan
 * DEĞİL — client'ın başka birinin uid'si adına çağrı yapması mümkün olmasın.
 */
export const ensureTenantForGoogleUser = onCall<EnsureTenantForGoogleUserInput>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Bu işlem için giriş yapmalısın.');
  }

  const uid = request.auth.uid;
  const email = request.auth.token.email ?? '';
  const { displayName, photoURL } = request.data ?? {};

  const userRef = db.collection('users').doc(uid);
  const existing = await userRef.get();
  if (existing.exists) {
    const data = existing.data()!;
    return { tenantId: data['tenantId'] as string, created: false };
  }

  const tenantRef = db.collection('tenants').doc();
  const tenantName = displayName ? `${displayName} Salonu` : 'Yeni Salon';
  const now = Timestamp.now();
  const trialEndsAt = Timestamp.fromMillis(now.toMillis() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

  const batch = db.batch();
  batch.set(tenantRef, {
    name: tenantName,
    slug: `${slugify(tenantName)}-${tenantRef.id.slice(0, 6)}`,
    createdAt: now,
  });
  batch.set(userRef, {
    uid,
    tenantId: tenantRef.id,
    email,
    displayName: displayName ?? 'Üye',
    photoURL: photoURL ?? null,
    role: 'admin',
    membershipStatus: 'trial',
    trialStartedAt: now,
    trialEndsAt,
    createdAt: now,
    updatedAt: now,
  });
  await batch.commit();

  await getAuth().setCustomUserClaims(uid, { role: 'admin', tenantId: tenantRef.id });

  return { tenantId: tenantRef.id, created: true };
});
