import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth/auth.service';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { formatDate, formatMoney } from '../../../shared/ui/ui-utils';
import { UserPackagesService } from '../user-packages.service';

@Component({
  selector: 'app-packages',
  standalone: true,
  imports: [MatIconModule, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans">
      <app-page-header
        title="Paketler"
        icon="card_membership"
        description="Salonun sunduğu üyelik paketleri. Satın almak için salon görevlisine başvur."
      />

      @if (auth.profile()?.packageLabel) {
        <div class="odv-card flex items-center gap-4 p-5 mb-6">
          <span class="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
            <mat-icon class="icon-size-5">verified</mat-icon>
          </span>
          <div>
            <p class="m-0 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mevcut Paketin</p>
            <p class="m-0 mt-0.5 font-bold text-slate-900 dark:text-white">
              {{ auth.profile()?.packageLabel }}
              @if (auth.profile()?.membershipEndsAt) {
                <span class="font-medium text-sm text-slate-500 dark:text-slate-400">
                  · {{ date(auth.profile()?.membershipEndsAt) }} tarihine kadar
                </span>
              }
            </p>
          </div>
        </div>
      }

      @if (packages() === null) {
        <p class="py-16 text-center text-sm text-slate-500 dark:text-slate-400 m-0">Yükleniyor…</p>
      } @else if (packages()!.length === 0) {
        <div class="odv-card py-16 text-center">
          <p class="m-0 text-sm text-slate-500 dark:text-slate-400">Salon henüz paket yayınlamadı.</p>
        </div>
      } @else {
        <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          @for (pkg of packages(); track pkg.id) {
            <div class="odv-card flex flex-col gap-2.5 p-6">
              <p class="m-0 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{{ pkg.name }}</p>
              <p class="m-0 text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {{ money(pkg.price) }}
                <span class="text-sm font-semibold text-slate-400">/ {{ pkg.durationDays }} gün</span>
              </p>
              @if (pkg.description) {
                <p class="m-0 text-xs text-slate-500 dark:text-slate-400">{{ pkg.description }}</p>
              }
              <ul class="list-none m-0 mb-2 p-0 flex flex-col gap-2 flex-1">
                @for (perk of pkg.features; track perk) {
                  <li class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <mat-icon class="icon-size-4.5 text-indigo-500 flex-shrink-0" [svgIcon]="'heroicons_solid:check-circle'"></mat-icon>
                    {{ perk }}
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class Packages {
  protected readonly auth = inject(AuthService);
  private readonly service = inject(UserPackagesService);

  protected readonly money = formatMoney;
  protected readonly date = formatDate;

  private readonly data = toSignal(this.service.watchAvailablePackages(), { initialValue: null });
  protected readonly packages = computed(() => {
    const list = this.data();
    return list && [...list].sort((a, b) => a.durationDays - b.durationDays);
  });
}
