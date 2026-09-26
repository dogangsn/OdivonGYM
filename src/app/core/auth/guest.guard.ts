import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';

/** Zaten giriş yapmış kullanıcı login/register sayfalarına giremesin. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const decide = () => !auth.isAuthenticated() || router.createUrlTree(['/dashboard']);

  if (auth.ready()) {
    return decide();
  }

  return toObservable(auth.ready).pipe(filter(Boolean), take(1), map(decide));
};
