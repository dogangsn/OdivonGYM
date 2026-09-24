import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertService } from '../../core/services/alert.service';
import { Router } from '@angular/router';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { AdminBranchesService } from './admin-branches.service';
import { BranchFormDialog } from './branch-form-dialog';
import { GymBranch, DAYS_OF_WEEK } from '../../core/models/gym-branch.model';
import { SaasSubscriptionService } from '../../core/services/saas-subscription.service';

const STATUS_LABEL: Record<GymBranch['status'], string> = {
  active: 'Açık / Faaliyette',
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
  imports: [CommonModule, PageHeader, MatIconModule, MatTooltipModule, BranchFormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <app-page-header
          title="Şubeler & Tesisler"
          icon="store"
          description="Salon şubelerini yönetin: Şube logosu, açık olduğu günler, çalışma saatleri ve kapasite."
        />
        <button
          type="button"
          (click)="openNew()"
          class="odv-btn-primary self-start text-xs sm:text-sm"
        >
          <mat-icon class="icon-size-4.5">add</mat-icon>
          <span>Yeni Şube Ekle</span>
        </button>
      </div>

      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        @if (loading()) {
          <p class="py-16 text-center text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>
        } @else if (branches().length === 0) {
          <div class="py-16 text-center">
            <div class="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <mat-icon class="icon-size-7">store</mat-icon>
            </div>
            <p class="text-sm font-bold text-slate-900 dark:text-white m-0">Henüz şube eklenmedi</p>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Salonunuza ait ilk şubeyi veya ana merkezi oluşturarak başlayın.
            </p>
            <button
              type="button"
              (click)="openNew()"
              class="odv-btn-primary text-xs"
            >
              + İlk Şubeyi Ekle
            </button>
          </div>
        } @else {
          <div class="overflow-x-auto custom-scroll">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th class="py-3.5 px-6">Şube & Logo</th>
                  <th class="py-3.5 px-6">İletişim & Konum</th>
                  <th class="py-3.5 px-6">Açık Günler & Saatler</th>
                  <th class="py-3.5 px-6">Kapasite</th>
                  <th class="py-3.5 px-6">Durum</th>
                  <th class="py-3.5 px-6 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
                @for (b of branches(); track b.id) {
                  <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <!-- Şube & Logo -->
                    <td class="py-3.5 px-6">
                      <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-slate-200 dark:border-slate-700/80 shrink-0 overflow-hidden shadow-xs flex items-center justify-center">
                          @if (b.logoUrl) {
                            <img [src]="b.logoUrl" alt="Logo" class="w-full h-full object-cover" />
                          } @else {
                            <mat-icon class="icon-size-6 text-indigo-600 dark:text-indigo-400">store</mat-icon>
                          }
                        </div>
                        <div>
                          <p class="font-bold text-slate-900 dark:text-white m-0 text-xs sm:text-sm flex items-center gap-1.5">
                            <span>{{ b.name }}</span>
                            @if (b.managerName) {
                              <span class="text-[10px] font-normal px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                Sorumlu: {{ b.managerName }}
                              </span>
                            }
                          </p>
                          <p class="text-[11px] text-slate-400 m-0 mt-0.5">
                            {{ b.address }}, {{ b.city }}
                          </p>
                        </div>
                      </div>
                    </td>

                    <!-- İletişim -->
                    <td class="py-3.5 px-6">
                      <p class="text-slate-800 dark:text-slate-200 font-semibold m-0 flex items-center gap-1">
                        <mat-icon class="icon-size-3.5 text-slate-400">phone</mat-icon>
                        {{ b.phone }}
                      </p>
                      <p class="text-[11px] text-slate-400 m-0 mt-0.5 flex items-center gap-1">
                        <mat-icon class="icon-size-3.5 text-slate-400">email</mat-icon>
                        {{ b.email }}
                      </p>
                    </td>

                    <!-- Açık Günler & Saatler -->
                    <td class="py-3.5 px-6">
                      <div class="space-y-1.5">
                        <div class="flex items-center gap-1.5">
                          <span class="text-xs font-bold text-slate-900 dark:text-white">
                            {{ hours(b) }}
                          </span>
                          <span class="text-[11px] text-slate-500 font-medium">
                            ({{ openDaysSummary(b) }})
                          </span>
                        </div>

                        <!-- 7 Gün Mini Pill Göstergesi -->
                        <div class="flex items-center gap-1">
                          @for (d of weekDays; track d.id) {
                            <span
                              class="text-[9px] px-1 py-0.2 rounded font-bold transition-all"
                              [ngClass]="isDayOpen(b, d.id)
                                ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 line-through opacity-60'"
                              [title]="d.label + (isDayOpen(b, d.id) ? ' (Açık)' : ' (Kapalı)')"
                            >
                              {{ d.short }}
                            </span>
                          }
                        </div>
                      </div>
                    </td>

                    <!-- Kapasite -->
                    <td class="py-3.5 px-6">
                      <div class="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <mat-icon class="icon-size-3.5 text-slate-400">people</mat-icon>
                        <span>{{ b.capacity }} Kişi</span>
                      </div>
                    </td>

                    <!-- Durum -->
                    <td class="py-3.5 px-6">
                      <span
                        class="px-2.5 py-1 rounded-lg text-xs font-semibold border"
                        [class]="statusClass[b.status]"
                      >
                        {{ statusLabel[b.status] }}
                      </span>
                    </td>

                    <!-- İşlemler -->
                    <td class="py-3.5 px-6 text-right whitespace-nowrap">
                      <div class="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          (click)="openEdit(b)"
                          title="Şubeyi Düzenle"
                          class="odv-icon-btn"
                        >
                          <mat-icon class="icon-size-4">edit</mat-icon>
                        </button>
                        <button
                          type="button"
                          (click)="remove(b)"
                          title="Şubeyi Sil"
                          class="odv-icon-btn odv-icon-btn-danger"
                        >
                          <mat-icon class="icon-size-4">delete</mat-icon>
                        </button>
                      </div>
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
  protected readonly weekDays = DAYS_OF_WEEK;

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

  isDayOpen(b: GymBranch, dayId: number): boolean {
    if (b.openDays && b.openDays.length > 0) {
      return b.openDays.includes(dayId);
    }
    const h = b.openingHours?.find((item) => item.day === dayId);
    return h ? !h.closed : true;
  }

  openDaysSummary(b: GymBranch): string {
    const openDayIds: number[] = this.weekDays
      .map((d) => d.id as number)
      .filter((dayId) => this.isDayOpen(b, dayId));

    if (openDayIds.length === 7) return 'Hergün Açık (7 Gün)';
    if (openDayIds.length === 5 && [1, 2, 3, 4, 5].every((d) => openDayIds.includes(d))) {
      return 'Hafta İçi (Pzt-Cum)';
    }
    if (openDayIds.length === 6 && [1, 2, 3, 4, 5, 6].every((d) => openDayIds.includes(d))) {
      return 'Pzt - Cmt';
    }
    if (openDayIds.length === 0) return 'Kapalı';

    const labels = this.weekDays
      .filter((d) => openDayIds.includes(d.id))
      .map((d) => d.short);
    return labels.join(', ');
  }
}
