import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Deneme süresi bitmiş / üyeliği pasif olan kullanıcıyı satın alma ekranına
 * yönlendirir. `authGuard`'dan sonra çalışacağı için oturumun açık olduğu
 * varsayılır.
 */
export const trialGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return toObservable(auth.ready).pipe(
    filter(Boolean),
    take(1),
    map(() => auth.canAccessApp() || router.createUrlTree(['/onboarding/trial-expired'])),
  );
};
