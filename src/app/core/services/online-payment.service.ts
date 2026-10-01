import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MobileApi } from '../api/mobile.api';
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
};

/**
 * Üye paket alımı. Gerçek bir kart/sanal POS entegrasyonu olmadığı için ödeme yalnız e-cüzdan
 * bakiyesinden yapılır: `POST /gym/mobile/membership/renew` bakiyeyi düşer, üyeliği uzatır ve
 * kasaya gelir kaydı yazar. Bakiye yetersizse sunucu satışı reddeder.
 */
@Injectable({ providedIn: 'root' })
export class OnlinePaymentService {
  private readonly api = inject(MobileApi);
  private readonly account = inject(MemberAccountService);

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
