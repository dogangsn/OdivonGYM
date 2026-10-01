import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardCheckoutRequest, MobileApi } from '../api/mobile.api';
import { toAppError } from '../../shared/models/app-error.model';
import { MemberAccountService } from './member-account.service';

/** Üyenin satın alabileceği paket (üye paket listesi ya da salon paketi). */
export interface PurchasablePackage {
  id: string;
  name: string;
  price: number;
  durationDays: number;
}

export interface PaymentResult {
  success: boolean;
  amount: number;
  paymentMethod: 'wallet';
  packageName?: string;
  newBalance?: number;
  newExpiryDate?: Date | null;
  message: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  GYM_WALLET_INSUFFICIENT: 'E-cüzdan bakiyeniz bu paket için yetersiz. Bakiye yüklemesi için resepsiyona başvurabilirsiniz.',
  GYM_PACKAGE_NOT_FOUND: 'Bu paket artık satışta değil. Lütfen listeyi yenileyip başka bir paket seçin.',
  GYM_MEMBER_FORBIDDEN: 'Paket satın alma yalnız üye hesaplarıyla yapılabilir.',
  INVALID_STATUS: 'Bu salonda kartla ödeme şu an açık değil. Lütfen resepsiyona başvurun.',
  FINANCE_INVALID: 'Ödeme sayfası açılamadı. Lütfen biraz sonra tekrar deneyin.',
  VALIDATION_ERROR: 'Tutar 50 TL ile 20.000 TL arasında olmalı.',
};

/**
 * Üye ödemeleri. Cüzdandan: `POST /gym/mobile/membership/renew` bakiyeyi düşer, üyeliği uzatır ve
 * kasaya gelir kaydı yazar. Kartla: iyzico ödeme sayfasına yönlendirilir (`startCardPayment`),
 * sonuç sunucuda doğrulanıp işlenir ve /payment-result sayfasına dönülür.
 */
@Injectable({ providedIn: 'root' })
export class OnlinePaymentService {
  private readonly api = inject(MobileApi);
  private readonly account = inject(MemberAccountService);

  /** null: henüz bilinmiyor. Salonun iyzico anahtarı yoksa kart seçeneği gizlenir. */
  readonly cardAvailable = signal<boolean | null>(null);
  private availabilityRequest: Promise<boolean> | null = null;

  loadCardAvailability(): Promise<boolean> {
    this.availabilityRequest ??= firstValueFrom(this.api.paymentAvailability()).then(
      (r) => r.card,
      () => false,
    ).then((card) => {
      this.cardAvailable.set(card);
      return card;
    });
    return this.availabilityRequest;
  }

  /**
   * Kartla ödemeyi başlatır ve iyzico ödeme sayfasının adresini döner (çağıran yönlendirir).
   * Tutar sunucuda belirlenir: paket fiyatı, açık borç; bakiye yüklemede seçilen tutar.
   */
  async startCardPayment(request: CardCheckoutRequest): Promise<string> {
    try {
      const session = await firstValueFrom(this.api.cardCheckout(request));
      if (!session.paymentPageUrl) throw new Error('Ödeme sayfası oluşturulamadı.');
      return session.paymentPageUrl;
    } catch (error) {
      const appError = toAppError(error);
      throw new Error(ERROR_MESSAGES[appError.code] ?? (appError.message || 'Kartla ödeme başlatılamadı.'));
    }
  }

  async purchasePackage(pkg: PurchasablePackage): Promise<PaymentResult> {
    try {
      const membership = await firstValueFrom(this.api.renew(pkg.id));
      const me = await this.account.reload();
      const ends = membership.endsAt ? new Date(membership.endsAt) : null;
      return {
        success: true,
        amount: pkg.price,
        paymentMethod: 'wallet',
        packageName: pkg.name,
        newBalance: me?.walletBalance,
        newExpiryDate: ends,
        message: ends
          ? `${pkg.name} tanımlandı. Üyeliğiniz ${ends.toLocaleDateString('tr-TR')} tarihine kadar geçerli.`
          : `${pkg.name} tanımlandı.`,
      };
    } catch (error) {
      const appError = toAppError(error);
      throw new Error(ERROR_MESSAGES[appError.code] ?? (appError.message || 'Paket satın alınamadı.'));
    }
  }
}
