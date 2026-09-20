import { Injectable, computed, effect, inject, signal } from '@angular/core';
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

  // Tüm şubelerin reaktif sinyali
  readonly branches = toSignal(this.branchesService.watchBranches(), { initialValue: [] as GymBranch[] });

  constructor() {
    effect(() => {
      const profile = this.auth.profile();
      const list = this.branches();
      // Admin kullanıcısı salona giriş yaptığında henüz şubesi yoksa varsayılanları otomatik oluştur
      if (profile?.role === 'admin' && profile.tenantId && list.length === 0 && !this.seedingTriggered) {
        this.seedingTriggered = true;
        void this.onboarding.ensureTenantDefaults(profile.tenantId, profile.displayName || 'Odivon GYM');
      }
    });
  }

  // Seçili şube ID sinyali (localStorage ile kalıcı)
  readonly selectedBranchId = signal<string | null>(localStorage.getItem(this.storageKey));

  // Aktif şube nesnesi
  readonly activeBranch = computed<GymBranch | null>(() => {
    const list = this.branches();
    if (!list || list.length === 0) return null;

    const selectedId = this.selectedBranchId();
    if (selectedId) {
      const found = list.find((b) => b.id === selectedId);
      if (found) return found;
    }

    // Seçili yoksa veya listede bulunamadıysa ilk aktif şubeyi varsayılan yap
    return list.find((b) => b.status === 'active') || list[0] || null;
  });

  // Üst barda ve arayüzde gösterilecek şube adı
  readonly activeBranchName = computed(() => {
    const branch = this.activeBranch();
    if (branch) return branch.name;
    const profile = this.auth.profile();
    return profile?.displayName ? `${profile.displayName} Salonu` : 'Merkez Şube';
  });

  // Çoklu şube var mı?
  readonly hasMultipleBranches = computed(() => this.branches().length > 1);

  // Şube değiştirme
  selectBranch(branch: GymBranch): void {
    this.selectedBranchId.set(branch.id);
    localStorage.setItem(this.storageKey, branch.id);
  }
}
