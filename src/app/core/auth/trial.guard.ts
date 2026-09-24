import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';
import { PermissionService } from '../services/permission.service';

/**
 * Deneme süresi bitmiş / üyeliği pasif olan son kullanıcıyı paket alma ekranına yönlendirir.
 * Kulüp yöneticileri ve personeli (owner, admin, staff) ise paket süresi bitse dahi menüyü
 * görebilmeleri, SaaS Paket & Lisans (/admin/subscription) ekranından yenileme yapabilmeleri
 * ve ekran kısıtlamalarını inceleyebilmeleri için kabuk arayüzüne her zaman erişebilir.
 */
export const trialGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const permissions = inject(PermissionService);
  const router = inject(Router);

  return toObservable(auth.ready).pipe(
    filter(Boolean),
    take(1),
    map(() => {
      if (auth.profile()?.email === 'expired@odivongym.app') {
        return router.createUrlTree(['/onboarding/trial-expired']);
      }
      if (permissions.isStaff()) {
        return true;
      }
      return auth.canAccessApp() || router.createUrlTree(['/onboarding/trial-expired']);
    }),
  );
};
