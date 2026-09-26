import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { WalletApi } from '../api/wallet.api';
import { AuthService } from '../auth/auth.service';
import { GymPackage } from '../models/gym-package.model';
import { toJsDate } from '../../shared/ui/ui-utils';

export interface CardPaymentInput {
  cardHolder: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
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
  private readonly wallet = inject(WalletApi);
  private readonly auth = inject(AuthService);

  detectCardBrand(cardNumber: string): CardBrand {
    const clean = cardNumber.replace(/\s+/g, '');
    if (/^4/.test(clean)) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(clean)) return 'mastercard';
    if (/^9792/.test(clean)) return 'troy';
    if (/^3[47]/.test(clean)) return 'amex';
    return 'unknown';
  }

  formatCardNumber(val: string): string {
    const clean = val.replace(/\D/g, '').slice(0, 16);
    return clean.replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  async verify3DSecure(card: CardPaymentInput): Promise<boolean> {
    const cleanNum = card.cardNumber.replace(/\s+/g, '');
    if (cleanNum.length < 15 || !card.cardHolder || !card.cvv) {
      throw new Error('Geçersiz kart bilgileri. Lütfen kart numarasını ve CVV kodunu kontrol edin.');
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
    return true;
  }

  async purchaseGymPackage(
    pkg: GymPackage,
    method: 'card' | 'wallet' | 'transfer',
    cardData?: CardPaymentInput,
  ): Promise<PaymentResult> {
    const profile = this.auth.profile();
    if (!profile?.uid) {
      throw new Error('Kullanıcı oturumu veya salon kaydı bulunamadı.');
    }
    if (method === 'card') {
      if (!cardData) throw new Error('Kart bilgileri girilmedi.');
      await this.verify3DSecure(cardData);
    }
    const member = await firstValueFrom(
      this.wallet.purchase({
        userId: profile.uid,
        name: pkg.name,
        amount: pkg.price,
        price: pkg.price,
        durationDays: pkg.durationDays,
        paymentMethod: method,
        description: `${pkg.name} (${pkg.durationDays} Gün) Üyelik Satın Alımı`,
      }),
    );
    const newExpiryDate = toJsDate(member.membershipEndsAt) ?? new Date();
    return {
      success: true,
      orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
      transactionId: `TX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      amount: pkg.price,
      paymentMethod: method,
      packageName: pkg.name,
      newBalance: member.walletBalance,
      newExpiryDate,
      message: `${pkg.name} başarıyla tanımlandı! Üyeliğiniz ${newExpiryDate.toLocaleDateString('tr-TR')} tarihine kadar uzatıldı.`,
    };
  }

  async topUpWallet(amount: number, cardData: CardPaymentInput): Promise<PaymentResult> {
    const profile = this.auth.profile();
    if (!profile?.uid) {
      throw new Error('Kullanıcı oturumu veya salon kaydı bulunamadı.');
    }
    if (amount <= 0) {
      throw new Error('Lütfen geçerli bir yükleme tutarı giriniz.');
    }
    await this.verify3DSecure(cardData);
    await firstValueFrom(
      this.wallet.adjust({
        userId: profile.uid,
        walletType: 'deposit',
        amount,
        description: 'Online Sanal POS ile Cüzdan Bakiye Yükleme',
        paymentMethod: 'card',
      }),
    );
    const newBalance = (profile.walletBalance ?? 0) + amount;
    const transactionId = `WL-${Date.now().toString().slice(-6)}`;
    return {
      success: true,
      orderNumber: transactionId,
      transactionId,
      amount,
      paymentMethod: 'card',
      newBalance,
      message: `₺${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} tutarındaki bakiye cüzdanınıza başarıyla yüklendi!`,
    };
  }
}
