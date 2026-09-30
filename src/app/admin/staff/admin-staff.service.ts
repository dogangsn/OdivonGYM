import { Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom, of, startWith, switchMap, tap } from 'rxjs';
import { GymApi } from '../../core/api/gym.api';
import { AuthService } from '../../core/auth/auth.service';
import { StaffMember, StaffStatus } from '../../core/models/staff.model';
import { BranchContextService } from '../../core/services/branch-context.service';

@Injectable({ providedIn: 'root' })
export class AdminStaffService {
  private readonly api = inject(GymApi);
  private readonly auth = inject(AuthService);
  private readonly branchContext = inject(BranchContextService);
  private readonly reload$ = new Subject<void>();
  readonly localStaff = signal<StaffMember[]>([]);

  watchStaff(): Observable<StaffMember[]> {
    return toObservable(this.auth.profile).pipe(
      switchMap((profile) => {
        if (!profile?.tenantId) {
          return of(this.localStaff());
        }
        return this.reload$.pipe(
          startWith(null),
          switchMap(() =>
            this.api.listStaff().pipe(
              tap((list) => this.localStaff.set(list)),
            ),
          ),
        );
      }),
    );
  }

  async createStaff(input: Partial<StaffMember>): Promise<string> {
    const activeBranch = this.branchContext.activeBranch();
    const created = await firstValueFrom(
      this.api.createStaff({
        ...input,
        branchId: input.branchId || activeBranch?.id || null,
        branchName: input.branchName || activeBranch?.name || null,
        branchIds: input.branchIds || (input.branchId ? [input.branchId] : activeBranch?.id ? [activeBranch.id] : []),
        branchNames: input.branchNames || (input.branchName ? [input.branchName] : activeBranch?.name ? [activeBranch.name] : []),
      }),
    );
    this.reload$.next();
    return created.id;
  }

  async updateStaff(id: string, input: Partial<StaffMember>): Promise<void> {
    await firstValueFrom(this.api.updateStaff(id, input));
    this.reload$.next();
  }

  async deleteStaff(id: string): Promise<void> {
    await firstValueFrom(this.api.deleteStaff(id));
    this.reload$.next();
  }

  async toggleStatus(id: string, currentStatus: StaffStatus): Promise<void> {
    const nextStatus: StaffStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await this.updateStaff(id, { status: nextStatus });
  }
}
