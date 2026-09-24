import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebase-admin';

interface ProcessOnlinePaymentInput {
  type: 'package_purchase' | 'wallet_topup';
  packageId?: string;
  amount: number;
  paymentMethod: 'card' | 'wallet' | 'transfer';
}

/**
 * Online Ödeme & Paket Satın Alma Cloud Function (Authoritative Backend)
 * Firebase Blaze veya Cloud Run ortamında çağrıldığında çalışır.
 */
export const processOnlinePayment = onCall<ProcessOnlinePaymentInput>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Bu işlem için giriş yapmış olmalısınız.');
  }

  const uid = request.auth.uid;
  const { type, packageId, amount, paymentMethod } = request.data ?? {};

  if (!amount || amount <= 0) {
    throw new HttpsError('invalid-argument', 'Geçerli bir ödeme tutarı belirtilmelidir.');
  }

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'Kullanıcı profili bulunamadı.');
  }

  const userData = userSnap.data()!;
  const tenantId = userData.tenantId;

  if (!tenantId) {
    throw new HttpsError('failed-precondition', 'Kullanıcının salon (tenant) kaydı bulunamadı.');
  }

  const now = new Date();
  const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
  const transactionId = `TX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  if (type === 'package_purchase') {
    if (!packageId) {
      throw new HttpsError('invalid-argument', 'Paket bilgisi eksik.');
    }

    const pkgSnap = await db.collection('gym_packages').doc(packageId).get();
    if (!pkgSnap.exists) {
      throw new HttpsError('not-found', 'Seçilen paket bulunamadı.');
    }

    const pkgData = pkgSnap.data()!;
    const durationDays = pkgData.durationDays || 30;

    // Cüzdan ile ödeme kontrolü
    let currentWalletBalance = userData.walletBalance || 0;
    if (paymentMethod === 'wallet') {
      if (currentWalletBalance < pkgData.price) {
        throw new HttpsError('failed-precondition', 'Cüzdan bakiyesi yetersiz.');
      }
      currentWalletBalance -= pkgData.price;
    }

    // Tarih hesaplama
    let baseStartDate = now;
    if (userData.membershipStatus === 'active' && userData.membershipEndsAt) {
      const endsDate = (userData.membershipEndsAt as Timestamp).toDate();
      if (endsDate.getTime() > now.getTime()) {
        baseStartDate = endsDate;
      }
    }

    const newExpiryDate = new Date(baseStartDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const batch = db.batch();

    // 1. Profil güncelleme
    const updatePayload: any = {
      membershipStatus: 'active',
      membershipEndsAt: Timestamp.fromDate(newExpiryDate),
      packageLabel: pkgData.name,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (paymentMethod === 'wallet') {
      updatePayload.walletBalance = currentWalletBalance;
    }
    batch.update(userRef, updatePayload);

    // 2. Cüzdan hareketi
    if (paymentMethod === 'wallet') {
      const txRef = db.collection('wallet_transactions').doc();
      batch.set(txRef, {
        tenantId,
        userId: uid,
        type: 'debit',
        amount: pkgData.price,
        description: `${pkgData.name} Üyelik Satın Alımı`,
        referenceId: packageId,
        referenceType: 'package',
        status: 'completed',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // 3. Salon kasa geliri
    const accRef = db.collection('accounting_entries').doc();
    batch.set(accRef, {
      tenantId,
      type: 'income',
      category: 'Üyelik Satışı',
      amount: pkgData.price,
      description: `${userData.displayName || 'Üye'} - ${pkgData.name} Online Satın Alım (${orderNumber})`,
      referenceId: packageId,
      referenceType: 'package',
      paymentMethod,
      entryDate: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });

    // 4. E-Fatura taslağı
    const invRef = db.collection('einvoice_items').doc();
    batch.set(invRef, {
      tenantId,
      invoiceNumber: `ODV${now.getFullYear()}${Math.floor(10000000 + Math.random() * 90000000)}`,
      direction: 'outbound',
      recipientName: userData.displayName || 'Sporcu',
      recipientVknOrTckn: '11111111111',
      amount: Math.round((pkgData.price / 1.2) * 100) / 100,
      kdvRate: 20,
      kdvAmount: Math.round((pkgData.price - pkgData.price / 1.2) * 100) / 100,
      totalAmount: pkgData.price,
      status: 'sent',
      invoiceType: 'earswive',
      provider: 'gib_portal',
      paymentMethod,
      paymentStatus: 'paid',
      description: `${pkgData.name} Hizmet Bedeli`,
      issueDate: FieldValue.serverTimestamp(),
      gibUuid: crypto.randomUUID(),
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return {
      success: true,
      orderNumber,
      transactionId,
      amount: pkgData.price,
      newExpiryDate: newExpiryDate.toISOString(),
      message: `${pkgData.name} başarıyla aktif edildi.`,
    };
  } else {
    // Cüzdan bakiye yükleme
    const currentBalance = userData.walletBalance || 0;
    const newBalance = currentBalance + amount;

    const batch = db.batch();

    batch.update(userRef, {
      walletBalance: newBalance,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const txRef = db.collection('wallet_transactions').doc();
    batch.set(txRef, {
      tenantId,
      userId: uid,
      type: 'deposit',
      amount,
      description: 'Online Sanal POS ile Cüzdan Bakiye Yükleme',
      status: 'completed',
      paymentMethod: 'card',
      referenceType: 'other',
      referenceId: transactionId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const accRef = db.collection('accounting_entries').doc();
    batch.set(accRef, {
      tenantId,
      type: 'income',
      category: 'Cüzdan Yükleme',
      amount,
      description: `${userData.displayName || 'Üye'} - Cüzdan Bakiye Yükleme`,
      paymentMethod: 'card',
      entryDate: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return {
      success: true,
      orderNumber: transactionId,
      transactionId,
      amount,
      newBalance,
      message: `₺${amount} tutarında bakiye cüzdanınıza yüklendi.`,
    };
  }
});
