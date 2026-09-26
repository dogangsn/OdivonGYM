import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AdminBranchesService } from '../../admin/branches/admin-branches.service';
import { AuthService } from '../auth/auth.service';
import { GymBranch } from '../models/gym-branch.model';
import { TenantOnboardingService } from './tenant-onboarding.service';

@Injectable({ providedIn: 'root' })
export class BranchContextService {
  private readonly branchesService = inject(AdminBranchesService);
  private readonly auth = inject(AuthService);
  private readonly onboarding = inject(TenantOnboardingService);
  private readonly storageKey = 'odivon_active_branch_id';
  private seedingTriggered = false;

  readonly branches = toSignal(this.branchesService.watchBranches(), { initialValue: [] as GymBranch[] });

  constructor() {
    const profile = this.auth.profile;
    // Seed once when owner has no branches yet.
    queueMicrotask(() => {
      const current = this.auth.profile();
      if (current?.tenantId && this.branches().length === 0 && !this.seedingTriggered) {
        this.seedingTriggered = true;
        void this.onboarding.ensureTenantDefaults();
      }
    });
    void profile;
  }

  readonly selectedBranchId = signal<string | null>(localStorage.getItem(this.storageKey));

  readonly activeBranch = computed<GymBranch | null>(() => {
    const list = this.branches();
    if (!list || list.length === 0) return null;
    const selectedId = this.selectedBranchId();
    if (selectedId) {
      const found = list.find((b) => b.id === selectedId);
      if (found) return found;
    }
    return list.find((b) => b.status === 'active') || list[0] || null;
  });

  readonly activeBranchName = computed(() => {
    const branch = this.activeBranch();
    if (branch) return branch.name;
    const profile = this.auth.profile();
    return profile?.displayName ? `${profile.displayName} Salonu` : 'Merkez Şube';
  });

  readonly hasMultipleBranches = computed(() => this.branches().length > 1);

  selectBranch(branch: GymBranch): void {
    this.selectedBranchId.set(branch.id);
    localStorage.setItem(this.storageKey, branch.id);
  }
}
