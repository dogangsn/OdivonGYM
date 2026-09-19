import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import { db, TRIAL_DURATION_DAYS } from '../firebase-admin';
import { mapCreateUserError } from './map-auth-error';

interface CreateTenantMemberInput {
  displayName: string;
  email: string;
  phone: string;
  password: string;
  gender: 'female' | 'male' | 'unspecified';
  birthDateMillis: number | null;
  membershipStatus: 'trial' | 'active' | 'expired' | 'cancelled';
  packageLabel: string | null;
  /** Üyeliğin başladığı tarih — hazır paket ya da "Özel Süre" fark etmez, client'ta hesaplanıp buraya gelir. */
  membershipStartMillis: number | null;
  /** Üyeliğin biteceği tarih — admin hazır paketin önerdiği tarihin üzerine yazabilir. */
  membershipEndMillis: number | null;
  notes: string;
}

/**
 * İş Kuralı 2: "Admin yetkisine sahip kullanıcı, KENDİ spor salonuna ait
 * sisteme yeni müşteriler ekleyebilmelidir."
 *
 * Kritik nokta: `tenantId`, hangi salona ekleneceği İSTEMCİDEN DEĞİL,
 * çağıranın doğrulanmış ID token'ındaki `tenantId` custom claim'inden
 * okunur (`request.auth.token.tenantId`). Bir admin, `request.data` içine
 * ne yazarsa yazsın başka bir salona üye ekleyemez — bu satır olmasaydı
 * (örn. tenantId'yi client body'sinden alsaydık) bütün izolasyon delinirdi.
 */
export const createTenantMember = onCall<CreateTenantMemberInput>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Bu işlem için giriş yapmalısın.');
  }

  const callerRole = request.auth.token['role'];
  const tenantId = request.auth.token['tenantId'] as string | undefined;

  if (callerRole !== 'admin' || !tenantId) {
    throw new HttpsError('permission-denied', 'Yalnızca salon yöneticisi yeni üye ekleyebilir.');
  }

  const {
    displayName,
    email,
    phone,
    password,
    gender,
    birthDateMillis,
    membershipStatus,
    packageLabel,
    membershipStartMillis,
    membershipEndMillis,
    notes,
  } = request.data ?? {};

  if (!displayName?.trim() || !email?.trim() || !password) {
    throw new HttpsError('invalid-argument', 'Ad soyad, e-posta ve şifre gerekli.');
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
    const now = Timestamp.now();
    const resolvedStatus = membershipStatus ?? 'trial';
    const trialEndsAt = Timestamp.fromMillis(now.toMillis() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
    const membershipStartsAt = membershipStartMillis ? Timestamp.fromMillis(membershipStartMillis) : null;
    const membershipEndsAt = membershipEndMillis ? Timestamp.fromMillis(membershipEndMillis) : null;

    await db
      .collection('users')
      .doc(userRecord.uid)
      .set({
        uid: userRecord.uid,
        tenantId, // <-- token'dan, admin'in KENDİ salonu
        email: email.trim(),
        displayName: displayName.trim(),
        photoURL: null,
        role: 'user',
        membershipStatus: resolvedStatus,
        trialStartedAt: now,
        trialEndsAt: resolvedStatus === 'trial' ? trialEndsAt : now,
        phone: phone ?? '',
        gender: gender ?? 'unspecified',
        birthDate: birthDateMillis ? Timestamp.fromMillis(birthDateMillis) : null,
        membershipStartsAt,
        membershipEndsAt,
        packageLabel: packageLabel ?? null,
        notes: notes ?? '',
        createdAt: now,
        updatedAt: now,
      });

    await auth.setCustomUserClaims(userRecord.uid, { role: 'user', tenantId });

    return { uid: userRecord.uid };
  } catch (error) {
    logger.error('createTenantMember: Firestore/claims aşaması başarısız, Auth kullanıcısı geri alınıyor', error);
    await auth.deleteUser(userRecord.uid).catch(() => undefined);
    throw new HttpsError('internal', 'Üye kaydedilemedi, lütfen tekrar dene.');
  }
});
