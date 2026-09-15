import * as functionsV1 from 'firebase-functions/v1';
import { logger } from 'firebase-functions';
import { Timestamp } from 'firebase-admin/firestore';
import { db, TRIAL_DURATION_DAYS } from '../firebase-admin';

/**
 * Yeni bir Firebase Auth kullanıcısı oluşturulduğunda (email/şifre kaydı VEYA
 * ilk Google girişi) tetiklenir ve `users/{uid}` dokümanını `trial`
 * durumuyla oluşturur. Bu, üyelik alanlarının otoriter/güvenli kaynağıdır —
 * client sadece bu Function henüz çalışmadıysa (bkz. AuthService,
 * firestore.rules "create") aynı şekli tek seferlik fallback olarak yazar.
 *
 * `firebase-functions/v1` kullanılıyor çünkü basit, bloklamayan auth
 * `onCreate` tetikleyicisi v2'de Identity Platform yükseltmesi gerektiriyor;
 * v1 ve v2 fonksiyonlar aynı codebase'te sorunsuz birlikte yaşar.
 */
export const createUserProfile = functionsV1.auth.user().onCreate(async (user) => {
  const userRef = db.collection('users').doc(user.uid);

  const existing = await userRef.get();
  if (existing.exists) {
    // Client fallback zaten oluşturmuş olabilir — üzerine yazıp
    // trialStartedAt'ı sıfırlamayalım.
    logger.info(`users/${user.uid} zaten var, createUserProfile atlanıyor.`);
    return;
  }

  const now = Timestamp.now();
  const trialEndsAt = Timestamp.fromMillis(now.toMillis() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await userRef.set({
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? 'Üye',
    photoURL: user.photoURL ?? null,
    role: 'user',
    membershipStatus: 'trial',
    trialStartedAt: now,
    trialEndsAt,
    createdAt: now,
    updatedAt: now,
  });

  logger.info(`users/${user.uid} trial profili oluşturuldu (bitiş: ${trialEndsAt.toDate().toISOString()}).`);
});
