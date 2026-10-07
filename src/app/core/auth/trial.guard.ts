import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateChildFn, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService, SAAS_RENEW_URL } from './auth.service';

/** Süresi biten salonda açık kalan sayfa (abonelik/ödeme). `/admin/subscriptions` (üye abonelikleri) değil. */
export function isSaasRenewUrl(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  return path === SAAS_RENEW_URL || path.startsWith(`${SAAS_RENEW_URL}/`);
}

/**
 * Deneme/abonelik süresi biten salonda panel kilitlenir: yönetici yalnızca abonelik ekranına
 * (ödeme ve çıkış oradan), personel ve üyeler paket ekranına gider. Bu kontrol kurulum
 * sihirbazından önce yapılır; sihirbazı bitirmemiş ama süresi dolmuş salon da ödemeye düşer.
 */
const decideFor = (state: RouterStateSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const decide = () => {
    if (auth.isSaasLocked()) {
      const target = auth.lockedLandingUrl();
      return target === SAAS_RENEW_URL && isSaasRenewUrl(state.url) ? true : router.createUrlTree([target]);
    }
    if (!auth.onboardingCompleted()) {
      return router.createUrlTree(['/onboarding/wizard']);
    }
    return true;
  };

  if (auth.ready()) {
    return decide();
  }

  return toObservable(auth.ready).pipe(filter(Boolean), take(1), map(decide));
};

export const trialGuard: CanActivateFn = (_route, state) => decideFor(state);

export const trialChildGuard: CanActivateChildFn = (_route, state) => decideFor(state);

/** Kurulum sihirbazı: süresi biten salon sihirbaz yerine ödeme ekranına gider. */
export const wizardGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const decide = () => !auth.isSaasLocked() || router.createUrlTree([auth.lockedLandingUrl()]);

  if (auth.ready()) {
    return decide();
  }

  return toObservable(auth.ready).pipe(filter(Boolean), take(1), map(decide));
};
