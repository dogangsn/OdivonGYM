import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  Timestamp,
} from '@angular/fire/firestore';
import { AuthService } from '../auth/auth.service';
import { GymPackage } from '../models/gym-package.model';

export interface CardPaymentInput {
  cardHolder: string;
  cardNumber: string; // 16 haneli
  expiryMonth: string; // MM
  expiryYear: string; // YY
  cvv: string; // 3-4 haneli
}

export interface PaymentResult {
  success: boolean;
  orderNumber: string;
  transactionId: string;
  amount: number;
  paymentMethod: 'card' | 'wallet' | 'transfer';
  packageName?: string;
  newBalance?: number;
  newExpiryDate?: Date;
  message: string;
}

export type CardBrand = 'visa' | 'mastercard' | 'troy' | 'amex' | 'unknown';

@Injectable({ providedIn: 'root' })
export class OnlinePaymentService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  /**
   * Kart markasını numaranın ilk hanelerine göre tespit eder
   */
  detectCardBrand(cardNumber: string): CardBrand {
    const clean = cardNumber.replace(/\s+/g, '');
    if (/^4/.test(clean)) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(clean)) return 'mastercard';
    if (/^9792/.test(clean)) return 'troy';
    if (/^3[47]/.test(clean)) return 'amex';
    return 'unknown';
  }

  /**
   * Kart numarasını 4'erli bloklar halinde biçimlendirir
   */
  formatCardNumber(val: string): string {
    const clean = val.replace(/\D/g, '').slice(0, 16);
    return clean.replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  /**
   * 3D Secure Doğrulama Simülasyonu
   * Gerçek PayTR / İyzico iframe / callback altyapısına hazır şekilde 800ms banka doğrulaması simüle eder.
   */
  async verify3DSecure(card: CardPaymentInput): Promise<boolean> {
    const cleanNum = card.cardNumber.replace(/\s+/g, '');
    if (cleanNum.length < 15 || !card.cardHolder || !card.cvv) {
      throw new Error('Geçersiz kart bilgileri. Lütfen kart numarasını ve CVV kodunu kontrol edin.');
    }
    // Simüle edilmiş banka gecikmesi
    await new Promise((resolve) => setTimeout(resolve, 800));
    return true;
  }

  /**
   * Üyelik / Spor Paketi Satın Alma
   */
  async purchaseGymPackage(
    pkg: GymPackage,
    method: 'card' | 'wallet' | 'transfer',
    cardData?: CardPaymentInput,
  ): Promise<PaymentResult> {
    const profile = this.auth.profile();
    if (!profile || !profile.uid || !profile.tenantId) {
      throw new Error('Kullanıcı oturumu veya salon kaydı bulunamadı.');
    }

    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
    const transactionId = `TX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    // 1. Cüzdan ile ödeme kontrolü
    let updatedWalletBalance = profile.walletBalance ?? 0;
    if (method === 'wallet') {
      if (updatedWalletBalance < pkg.price) {
        throw new Error(
          `Cüzdan bakiyeniz yetersiz! (Mevcut: ₺${updatedWalletBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}, Gerekli: ₺${pkg.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })})`,
        );
      }
      updatedWalletBalance -= pkg.price;
    } else if (method === 'card') {
      if (!cardData) throw new Error('Kart bilgileri girilmedi.');
      await this.verify3DSecure(cardData);
    }

    // 2. Yeni Bitiş Tarihini Hesapla
    const now = new Date();
    let baseStartDate = now;
    const currentEndsAt = profile.membershipEndsAt?.toDate?.() || null;

    // Eğer mevcut üyeliği aktif ve gelecekte bitiyorsa, sürenin üstüne ekle (kesintisiz uzatma)
    if (profile.membershipStatus === 'active' && currentEndsAt && currentEndsAt.getTime() > now.getTime()) {
      baseStartDate = currentEndsAt;
    }

    const newExpiryDate = new Date(baseStartDate.getTime() + pkg.durationDays * 24 * 60 * 60 * 1000);

    // 3. Kullanıcı Profilini Güncelle
    const userRef = doc(this.firestore, 'users', profile.uid);
    const userUpdatePayload: any = {
      membershipStatus: 'active',
      membershipStartsAt: profile.membershipStartsAt || Timestamp.fromDate(now),
      membershipEndsAt: Timestamp.fromDate(newExpiryDate),
      packageLabel: pkg.name,
      updatedAt: serverTimestamp(),
    };

    if (method === 'wallet') {
      userUpdatePayload.walletBalance = updatedWalletBalance;
    }

    await updateDoc(userRef, userUpdatePayload);

    // 4. Cüzdan Hareketi (wallet_transactions) Kaydı
    if (method === 'wallet') {
      await addDoc(collection(this.firestore, 'wallet_transactions'), {
        tenantId: profile.tenantId,
        userId: profile.uid,
        type: 'debit',
        amount: pkg.price,
        description: `${pkg.name} (${pkg.durationDays} Gün) Üyelik Satın Alımı`,
        referenceId: pkg.id,
        referenceType: 'package',
        status: 'completed',
        paymentMethod: 'cash',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 5. Salon Kasa / Ön Muhasebe Hareketi (accounting_entries)
    try {
      await addDoc(collection(this.firestore, 'accounting_entries'), {
        tenantId: profile.tenantId,
        type: 'income',
        category: 'Üyelik Satışı',
        amount: pkg.price,
        description: `${profile.displayName || 'Üye'} - ${pkg.name} Online Satın Alım (${orderNumber})`,
        referenceId: pkg.id,
        referenceType: 'package',
        paymentMethod: method === 'wallet' ? 'wallet' : method === 'transfer' ? 'transfer' : 'card',
        notes: `Online işlem referansı: ${transactionId} · Paket süresi: ${pkg.durationDays} gün`,
        entryDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Accounting entry kaydı atlandı:', e);
    }

    // 6. E-Fatura / E-Arşiv Taslak Faturası (einvoice_items)
    try {
      const baseAmount = Math.round((pkg.price / 1.2) * 100) / 100;
      const kdvAmount = Math.round((pkg.price - baseAmount) * 100) / 100;
      await addDoc(collection(this.firestore, 'einvoice_items'), {
        tenantId: profile.tenantId,
        invoiceNumber: `ODV${now.getFullYear()}${Math.floor(10000000 + Math.random() * 90000000)}`,
        direction: 'outbound',
        recipientName: profile.displayName || 'Değerli Sporcu',
        recipientVknOrTckn: '11111111111',
        recipientAddress: profile.country || 'Türkiye',
        amount: baseAmount,
        kdvRate: 20,
        kdvAmount,
        totalAmount: pkg.price,
        status: 'sent',
        invoiceType: 'earswive',
        provider: 'gib_portal',
        paymentMethod: method === 'wallet' ? 'wallet' : method === 'transfer' ? 'transfer' : 'card',
        paymentStatus: 'paid',
        description: `${pkg.name} (${pkg.durationDays} Gün) Hizmet Bedeli`,
        issueDate: serverTimestamp(),
        gibUuid: crypto.randomUUID(),
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('E-Arşiv fatura taslağı atlandı:', e);
    }

    return {
      success: true,
      orderNumber,
      transactionId,
      amount: pkg.price,
      paymentMethod: method,
      packageName: pkg.name,
      newBalance: updatedWalletBalance,
      newExpiryDate,
      message: `${pkg.name} başarıyla tanımlandı! Üyeliğiniz ${newExpiryDate.toLocaleDateString('tr-TR')} tarihine kadar uzatıldı.`,
    };
  }

  /**
   * E-Cüzdana Kredi / Banka Kartı ile Bakiye Yükleme
   */
  async topUpWallet(amount: number, cardData: CardPaymentInput): Promise<PaymentResult> {
    const profile = this.auth.profile();
    if (!profile || !profile.uid || !profile.tenantId) {
      throw new Error('Kullanıcı oturumu veya salon kaydı bulunamadı.');
    }

    if (amount <= 0) {
      throw new Error('Lütfen geçerli bir yükleme tutarı giriniz.');
    }

    // 1. 3D Secure Doğrulama
    await this.verify3DSecure(cardData);

    const transactionId = `WL-${Date.now().toString().slice(-6)}`;
    const currentBalance = profile.walletBalance ?? 0;
    const newBalance = currentBalance + amount;

    // 2. Kullanıcı Cüzdan Bakiyesini Güncelle
    const userRef = doc(this.firestore, 'users', profile.uid);
    await updateDoc(userRef, {
      walletBalance: newBalance,
      updatedAt: serverTimestamp(),
    });

    // 3. Cüzdan Hareketi (wallet_transactions)
    await addDoc(collection(this.firestore, 'wallet_transactions'), {
      tenantId: profile.tenantId,
      userId: profile.uid,
      type: 'deposit',
      amount,
      description: 'Online Sanal POS ile Cüzdan Bakiye Yükleme',
      status: 'completed',
      paymentMethod: 'card',
      referenceType: 'other',
      referenceId: transactionId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 4. Salon Kasa Geliri (accounting_entries)
    try {
      await addDoc(collection(this.firestore, 'accounting_entries'), {
        tenantId: profile.tenantId,
        type: 'income',
        category: 'Cüzdan Yükleme',
        amount,
        description: `${profile.displayName || 'Üye'} - Cüzdan Bakiye Yükleme (POS: ${transactionId})`,
        paymentMethod: 'card',
        referenceType: 'other',
        referenceId: transactionId,
        entryDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Accounting entry kaydı atlandı:', e);
    }

    return {
      success: true,
      orderNumber: transactionId,
      transactionId,
      amount,
      paymentMethod: 'card',
      newBalance,
      message: `₺${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} tutarındaki bakiye cüzdanınıza başarıyla yüklendi! Yeni bakiyeniz: ₺${newBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
    };
  }
}
