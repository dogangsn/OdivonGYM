import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import { db, TRIAL_DURATION_DAYS } from '../firebase-admin';
import { slugify } from './slugify';
import { mapCreateUserError } from './map-auth-error';

interface CreateTenantWithAdminInput {
  tenantName: string;
  email: string;
  password: string;
  displayName: string;
  /** ISO 3166-1 alpha-2 (örn. "TR") — kayıt formundaki ülke seçiciden gelir. */
  country: string;
  /** Çevirme kodu dahil tam telefon (örn. "+90 555 123 45 67"). */
  phone: string;
  /** Kayıt anında arayüzde aktif olan dil (örn. "tr") — bkz. LanguageService. */
  language: string;
}

/**
 * İş Kuralı 1: "Yeni bir spor salonu kaydedildiğinde, işlemi yapan ilk
 * kullanıcı otomatik olarak Admin rolünü alır."
 *
 * `tenants/{tenantId}` ve `users/{uid}` dokümanları — ve Auth kullanıcısının
 * kendisi — TEK bir callable Function çağrısında, Admin SDK ile oluşturulur.
 * Client'ın bunu iki ayrı adıma (Auth create + Firestore write) bölmesine
 * izin VERİLMEZ (bkz. firestore.rules: `users` koleksiyonunda `allow create`
 * yok) — aksi halde yarım kalmış (tenant'sız kullanıcı ya da admin'siz
 * tenant) bir kayıt oluşabilirdi.
 *
 * Custom Claims (`role`, `tenantId`) burada, Admin SDK ile set edilir —
 * client SDK'nın bunu yapma yetkisi yoktur. Bu ikisi, `firestore.rules`
 * içindeki tüm izolasyon kontrollerinin dayandığı tek gerçek kaynaktır.
 */
export const createTenantWithAdmin = onCall<CreateTenantWithAdminInput>(async (request) => {
  const { tenantName, email, password, displayName, country, phone, language } = request.data ?? {};

  if (!tenantName?.trim() || !email?.trim() || !password || !displayName?.trim()) {
    throw new HttpsError('invalid-argument', 'Salon adı, e-posta, şifre ve ad soyad gerekli.');
  }
  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'Şifre en az 6 karakter olmalı.');
  }

  const auth = getAuth();

  const userRecord = await auth
    .createUser({
      email: email.trim(),
      password,
      displayName: displayName.trim(),
    })
    .catch(mapCreateUserError);

  try {
    const tenantRef = db.collection('tenants').doc();
    const now = Timestamp.now();
    const trialEndsAt = Timestamp.fromMillis(now.toMillis() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const batch = db.batch();
    batch.set(tenantRef, {
      name: tenantName.trim(),
      slug: `${slugify(tenantName)}-${tenantRef.id.slice(0, 6)}`,
      createdAt: now,
    });
    batch.set(db.collection('users').doc(userRecord.uid), {
      uid: userRecord.uid,
      tenantId: tenantRef.id,
      email: email.trim(),
      displayName: displayName.trim(),
      photoURL: null,
      role: 'admin',
      membershipStatus: 'trial',
      trialStartedAt: now,
      trialEndsAt,
      country: country ?? null,
      phone: phone ?? null,
      language: language ?? 'tr',
      createdAt: now,
      updatedAt: now,
    });
    await batch.commit();

    await auth.setCustomUserClaims(userRecord.uid, { role: 'admin', tenantId: tenantRef.id });

    return { tenantId: tenantRef.id, uid: userRecord.uid };
  } catch (error) {
    // Firestore tarafı başarısız olduysa yetim bir Auth kullanıcısı
    // bırakmayalım — kayıt bütünüyle geri alınmış olsun.
    logger.error('createTenantWithAdmin: Firestore/claims aşaması başarısız, Auth kullanıcısı geri alınıyor', error);
    await auth.deleteUser(userRecord.uid).catch(() => undefined);
    throw new HttpsError('internal', 'Kayıt tamamlanamadı, lütfen tekrar dene.');
  }
});
