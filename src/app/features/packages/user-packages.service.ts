import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, of, switchMap } from 'rxjs';
import { GymApi } from '../../core/api/gym.api';
import { AuthService } from '../../core/auth/auth.service';
import { GymPackage } from '../../core/models/gym-package.model';

@Injectable({ providedIn: 'root' })
export class UserPackagesService {
  private readonly api = inject(GymApi);
  private readonly auth = inject(AuthService);

  watchAvailablePackages(): Observable<GymPackage[]> {
    return toObservable(this.auth.profile).pipe(
      switchMap((profile) => (profile?.tenantId ? this.api.listPackages(true) : of([]))),
    );
  }
}
