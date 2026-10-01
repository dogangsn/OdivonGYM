import { Injectable, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MobileApi, MobileMe } from '../api/mobile.api';
import { AuthService } from '../auth/auth.service';

/**
 * Üyenin kendi hesap özeti (`/gym/mobile/me`): cüzdan bakiyesi ve üyelik durumu. `/identity/me`
 * bu alanları taşımadığı için üye sayfaları bakiyeyi buradan okur. Yalnız üye hesaplarında yüklenir.
 */
@Injectable({ providedIn: 'root' })
export class MemberAccountService {
  private readonly api = inject(MobileApi);
  private readonly auth = inject(AuthService);

  readonly me = signal<MobileMe | null>(null);
  readonly loading = signal(false);

  constructor() {
    effect(() => {
      const profile = this.auth.profile();
      if (profile?.role === 'user' && profile.tenantId) {
        void this.reload();
      } else {
        this.me.set(null);
      }
    });
  }

  async reload(): Promise<MobileMe | null> {
    this.loading.set(true);
    try {
      const me = await firstValueFrom(this.api.me());
      this.me.set(me);
      return me;
    } catch {
      // Personel önizlemesi ya da üye kaydı olmayan hesap: bakiye gösterilmez.
      this.me.set(null);
      return null;
    } finally {
      this.loading.set(false);
    }
  }
}
