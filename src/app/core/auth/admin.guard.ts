import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateChildFn, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';
import { PermissionService } from '../services/permission.service';

/**
 * Kulüp personeli değilse `/dashboard`'a, personelin rolü bu sayfaya izin vermiyorsa
 * `/admin/overview`'a yönlendirir. Menüde gizlenen sayfalar adres çubuğundan da açılamaz.
 * Asıl yetki denetimi MainApi'dedir; bu guard yalnızca arayüzü rolle tutarlı tutar.
 */
const decideFor = (state: RouterStateSnapshot) => {
  const auth = inject(AuthService);
  const permissions = inject(PermissionService);
  const router = inject(Router);

  const decide = () => {
    if (!permissions.isStaff()) return router.createUrlTree(['/dashboard']);
    const path = state.url.split(/[?#]/)[0];
    if (permissions.canAccessRoute(path)) return true;
    return path.startsWith('/admin/overview')
      ? router.createUrlTree(['/dashboard'])
      : router.createUrlTree(['/admin/overview']);
  };

  if (auth.ready()) {
    return decide();
  }

  return toObservable(auth.ready).pipe(filter(Boolean), take(1), map(decide));
};

export const adminGuard: CanActivateFn = (_route, state) => decideFor(state);

export const adminChildGuard: CanActivateChildFn = (_route, state) => decideFor(state);
