import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebase-admin';

/**
 * Her gün 03:00 (Europe/Istanbul) çalışır: deneme süresi geçmiş kullanıcıları
 * `expired` yapar. Bu, `membershipStatus`'un otoriter kaynağıdır — client
 * sadece `trialEndsAt`'a bakarak anlık UX için aynı sonucu hesaplar (bkz.
 * AuthService.isTrialExpired), gün sonunu beklemeden erişimi keser.
 */
export const expireTrials = onSchedule(
  { schedule: 'every day 03:00', timeZone: 'Europe/Istanbul' },
  async () => {
    const now = Timestamp.now();
    const expiredUsers = await db
      .collection('users')
      .where('membershipStatus', '==', 'trial')
      .where('trialEndsAt', '<=', now)
      .get();

    if (expiredUsers.empty) {
      logger.info('Süresi dolan deneme kullanıcısı yok.');
      return;
    }

    // Firestore batch'leri en fazla 500 yazma kabul eder — güvenli tarafta
    // kalmak için 400'lük gruplara bölüyoruz.
    const docs = expiredUsers.docs;
    const chunkSize = 400;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const batch = db.batch();
      docs.slice(i, i + chunkSize).forEach((doc) => {
        batch.update(doc.ref, { membershipStatus: 'expired', updatedAt: now });
      });
      await batch.commit();
    }

    logger.info(`${expiredUsers.size} kullanıcının denemesi 'expired' olarak işaretlendi.`);
  },
);
