import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { GymApi } from '../../core/api/gym.api';
import { MobileApi, MobilePackage } from '../../core/api/mobile.api';
import { AuthService } from '../../core/auth/auth.service';

@Injectable({ providedIn: 'root' })
export class UserPackagesService {
  private readonly gym = inject(GymApi);
  private readonly mobile = inject(MobileApi);
  private readonly auth = inject(AuthService);

  /**
   * Üye hesabı `/gym/mobile/packages` (aktif ve gizli olmayan paketler) okur; personel uçları üyeye
   * 403 döner. Personel bu sayfayı önizlediğinde salonun aktif paketleri gösterilir.
   */
  watchAvailablePackages(): Observable<MobilePackage[]> {
    return toObservable(this.auth.profile).pipe(
      switchMap((profile) => {
        if (!profile?.tenantId) return of([]);
        if (profile.role === 'user') return this.mobile.packages();
        return this.gym.listPackages(true).pipe(
          map((list) =>
            list
              .filter((p) => p.status === 'active' && !p.isHidden)
              .map((p) => ({
                id: p.id,
                name: p.name,
                price: p.price,
                durationDays: p.durationDays,
                features: p.features ?? [],
                description: p.description ?? '',
              })),
          ),
        );
      }),
      catchError(() => of([] as MobilePackage[])),
    );
  }
}
