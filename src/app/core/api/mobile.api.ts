import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { unwrapList } from './unwrap';

/** Sunucudaki membershipSummary(): durum, paket adı (type), kalan gün, başlangıç/bitiş. */
export interface MembershipSummary {
  status: string;
  type: string | null;
  daysLeft: number | null;
  startsAt: string | null;
  endsAt: string | null;
}

/** `/gym/mobile/me` — yalnız üye hesabı; kimlik token'dan gelir. */
export interface MobileMe {
  uid: string;
  displayName: string;
  email: string;
  memberNumber: string | null;
  walletBalance: number;
  membership: MembershipSummary;
}

/** `/gym/mobile/membership` (üyelik detay özeti). */
export interface MobileMembership extends MembershipSummary {
  packageName: string | null;
  packagePrice: number | null;
  features: string[];
}

/** `/gym/mobile/packages` — üyeye açık (aktif, gizli olmayan) paketler. */
export interface MobilePackage {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  features: string[];
  description: string;
}

/**
 * Üye uçları (`/gym/mobile/*`). Personel uçlarının (`/gym/wallet`, `/gym/packages`…) aksine üye
 * hesabıyla çağrılabilir; kullanıcı kimliği her zaman token'dan alınır, gövdeden değil.
 */
@Injectable({ providedIn: 'root' })
export class MobileApi {
  private readonly api = inject(ApiClient);

  me() {
    return this.api.get<MobileMe>('/gym/mobile/me').pipe(map((r) => r.data));
  }

  membership() {
    return this.api.get<MobileMembership>('/gym/mobile/membership').pipe(map((r) => r.data));
  }

  packages() {
    return this.api.get<MobilePackage[]>('/gym/mobile/packages').pipe(map((r) => unwrapList<MobilePackage>(r.data)));
  }

  /** Paketi e-cüzdan bakiyesinden öder ve üyeliği uzatır; güncel üyelik özetini döner. */
  renew(packageId: string) {
    return this.api
      .post<MobileMembership>('/gym/mobile/membership/renew', { packageId })
      .pipe(map((r) => r.data));
  }
}
