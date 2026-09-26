import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom, of, startWith, switchMap } from 'rxjs';
import { GymApi } from '../../core/api/gym.api';
import { AuthService } from '../../core/auth/auth.service';
import { GymBranch, CreateGymBranchInput, UpdateGymBranchInput } from '../../core/models/gym-branch.model';

@Injectable({ providedIn: 'root' })
export class AdminBranchesService {
  private readonly api = inject(GymApi);
  private readonly auth = inject(AuthService);
  private readonly reload$ = new Subject<void>();

  watchBranches(): Observable<GymBranch[]> {
    return toObservable(this.auth.profile).pipe(
      switchMap((profile) => {
        if (!profile?.tenantId) {
          return of([] as GymBranch[]);
        }
        return this.reload$.pipe(
          startWith(null),
          switchMap(() => this.api.listBranches()),
        );
      }),
    );
  }

  async createBranch(input: CreateGymBranchInput): Promise<string> {
    const created = await firstValueFrom(this.api.createBranch(input));
    this.reload$.next();
    return created.id;
  }

  async updateBranch(id: string, input: UpdateGymBranchInput): Promise<void> {
    await firstValueFrom(this.api.updateBranch(id, input));
    this.reload$.next();
  }

  async deleteBranch(id: string): Promise<void> {
    await firstValueFrom(this.api.deleteBranch(id));
    this.reload$.next();
  }
}
