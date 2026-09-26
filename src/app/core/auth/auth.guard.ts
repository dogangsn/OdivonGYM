import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';

/** Oturum açılmamışsa `/auth/login`'e yönlendirir. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const decide = () => auth.isAuthenticated() || router.createUrlTree(['/auth/login']);

  // Zonesuz uygulamada `toObservable` ilk değeri ancak sonraki değişim algılamasında
  // yayınlar. Oturum zaten hazırsa yönlendirme bu yüzden askıda kalır; senkron karar ver.
  if (auth.ready()) {
    return decide();
  }

  return toObservable(auth.ready).pipe(filter(Boolean), take(1), map(decide));
};
