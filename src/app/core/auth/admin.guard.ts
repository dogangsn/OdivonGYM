import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';
import { PermissionService } from '../services/permission.service';

/** Kulüp personeli ('owner', 'admin', 'trainer', 'receptionist') değilse `/dashboard`'a yönlendirir. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const permissions = inject(PermissionService);
  const router = inject(Router);

  return toObservable(auth.ready).pipe(
    filter(Boolean),
    take(1),
    map(() => permissions.isStaff() || router.createUrlTree(['/dashboard'])),
  );
};
