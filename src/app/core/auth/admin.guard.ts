import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';

/** `role !== 'admin'` ise `/dashboard`'a geri gönderir. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return toObservable(auth.ready).pipe(
    filter(Boolean),
    take(1),
    map(() => auth.profile()?.role === 'admin' || router.createUrlTree(['/dashboard'])),
  );
};
