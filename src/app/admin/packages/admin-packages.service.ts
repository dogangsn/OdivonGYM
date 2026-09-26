import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom, of, startWith, switchMap } from 'rxjs';
import { GymApi } from '../../core/api/gym.api';
import { AuthService } from '../../core/auth/auth.service';
import { GymPackage, CreateGymPackageInput, UpdateGymPackageInput } from '../../core/models/gym-package.model';

@Injectable({ providedIn: 'root' })
export class AdminPackagesService {
  private readonly api = inject(GymApi);
  private readonly auth = inject(AuthService);
  private readonly reload$ = new Subject<void>();

  watchPackages(): Observable<GymPackage[]> {
    return toObservable(this.auth.profile).pipe(
      switchMap((profile) => {
        if (!profile?.tenantId) {
          return of([] as GymPackage[]);
        }
        return this.reload$.pipe(
          startWith(null),
          switchMap(() => this.api.listPackages()),
        );
      }),
    );
  }

  async createPackage(input: CreateGymPackageInput): Promise<string> {
    const created = await firstValueFrom(this.api.createPackage(input));
    this.reload$.next();
    return created.id;
  }

  async updatePackage(id: string, input: UpdateGymPackageInput): Promise<void> {
    await firstValueFrom(this.api.updatePackage(id, input));
    this.reload$.next();
  }

  async deletePackage(id: string): Promise<void> {
    await firstValueFrom(this.api.deletePackage(id));
    this.reload$.next();
  }
}
