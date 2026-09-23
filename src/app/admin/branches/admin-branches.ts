import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertService } from '../../core/services/alert.service';
import { Router } from '@angular/router';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { AdminBranchesService } from './admin-branches.service';
import { BranchFormDialog } from './branch-form-dialog';
import { GymBranch } from '../../core/models/gym-branch.model';
import { SaasSubscriptionService } from '../../core/services/saas-subscription.service';

const STATUS_LABEL: Record<GymBranch['status'], string> = {
  active: 'Açık',
  maintenance: 'Bakımda',
  closed: 'Kapalı',
};

const STATUS_CLASS: Record<GymBranch['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/40',
  maintenance: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/40',
  closed: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

@Component({
  selector: 'app-admin-branches',
  standalone: true,
  imports: [PageHeader, MatIconModule, BranchFormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <app-page-header
          title="Şubeler"
          icon="store"
          description="Birden fazla salon şubesini yönet — adres, çalışma saatleri, kapasite."
        />
        <button
          type="button"
          (click)="openNew()"
          class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center gap-2 cursor-pointer self-start"
        >
          <mat-icon class="icon-size-4.5">add</mat-icon>
          <span>Yeni Şube</span>
        </button>
      </div>

      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        @if (loading()) {
          <p class="py-16 text-center text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>
        } @else if (branches().length === 0) {
          <div class="py-16 text-center">
            <p class="text-sm text-slate-500 dark:text-slate-400 m-0">Henüz şube eklenmedi.</p>
            <button
              type="button"
              (click)="openNew()"
              class="mt-4 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold cursor-pointer"
            >
              + İlk Şubeyi Ekle
            </button>
          </div>
        } @else {
          <div class="overflow-x-auto custom-scroll">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th class="py-3.5 px-6">Şube</th>
                  <th class="py-3.5 px-6">İletişim</th>
                  <th class="py-3.5 px-6">Saatler</th>
                  <th class="py-3.5 px-6">Kapasite</th>
                  <th class="py-3.5 px-6">Durum</th>
                  <th class="py-3.5 px-6 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
                @for (b of branches(); track b.id) {
                  <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td class="py-3 px-6">
                      <p class="font-bold text-slate-900 dark:text-white m-0">{{ b.name }}</p>
                      <p class="text-[11px] text-slate-400 m-0">{{ b.address }}, {{ b.city }}</p>
                    </td>
                    <td class="py-3 px-6">
                      <p class="text-slate-700 dark:text-slate-200 m-0">{{ b.phone }}</p>
                      <p class="text-[11px] text-slate-400 m-0">{{ b.email }}</p>
                    </td>
                    <td class="py-3 px-6 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {{ hours(b) }}
                    </td>
                    <td class="py-3 px-6 text-slate-600 dark:text-slate-300">{{ b.capacity }}</td>
                    <td class="py-3 px-6">
                      <span
                        class="px-2.5 py-1 rounded-lg text-xs font-semibold border"
                        [class]="statusClass[b.status]"
                      >
                        {{ statusLabel[b.status] }}
                      </span>
                    </td>
                    <td class="py-3 px-6 text-right whitespace-nowrap">
                      <button
                        type="button"
                        (click)="openEdit(b)"
                        title="Düzenle"
                        class="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 inline-flex items-center justify-center cursor-pointer"
                      >
                        <mat-icon class="icon-size-4" [svgIcon]="'heroicons_outline:pencil'"></mat-icon>
                      </button>
                      <button
                        type="button"
                        (click)="remove(b)"
                        title="Sil"
                        class="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-rose-600 inline-flex items-center justify-center cursor-pointer ml-1"
                      >
                        <mat-icon class="icon-size-4">delete</mat-icon>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    <app-branch-form-dialog [open]="drawerOpen()" [branch]="editing()" (closed)="onClosed($event)" />
  `,
})
export class AdminBranches {
  private readonly service = inject(AdminBranchesService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);
  private readonly saasSub = inject(SaasSubscriptionService);

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusClass = STATUS_CLASS;

  private readonly data = toSignal(this.service.watchBranches(), { initialValue: null });
  protected readonly loading = computed(() => this.data() === null);
  protected readonly branches = computed(() =>
    [...(this.data() ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'tr')),
  );

  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<GymBranch | null>(null);

  openNew(): void {
    const check = this.saasSub.canAddBranch();
    if (!check.allowed) {
      this.snackBar
        .open(check.reason || 'Şube limitine ulaşıldı.', 'Paketi Yükselt', { duration: 6000 })
        .onAction()
        .subscribe(() => {
          void this.router.navigateByUrl('/admin/subscription');
        });
      return;
    }
    this.editing.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(b: GymBranch): void {
    this.editing.set(b);
    this.drawerOpen.set(true);
  }

  onClosed(saved: boolean): void {
    this.drawerOpen.set(false);
    if (saved) {
      this.snackBar.open(this.editing() ? 'Şube güncellendi.' : 'Şube eklendi.', 'Kapat', { duration: 3000 });
    }
    this.editing.set(null);
  }

  async remove(b: GymBranch): Promise<void> {
    if (!(await this.alertService.deleteConfirm(b.name))) return;
    try {
      await this.service.deleteBranch(b.id);
      this.alertService.toastSuccess('Şube silindi.');
    } catch {
      this.alertService.toastError('Şube silinemedi, tekrar dene.');
    }
  }

  hours(b: GymBranch): string {
    const h = b.openingHours?.[0];
    return h ? `${h.open} – ${h.close}` : '—';
  }
}
