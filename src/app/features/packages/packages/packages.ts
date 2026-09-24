import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth/auth.service';
import { GymPackage } from '../../../core/models/gym-package.model';
import { AlertService } from '../../../core/services/alert.service';
import { CheckoutModal } from '../../../shared/components/checkout-modal/checkout-modal';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { formatDate, formatMoney } from '../../../shared/ui/ui-utils';
import { UserPackagesService } from '../user-packages.service';

@Component({
  selector: 'app-packages',
  standalone: true,
  imports: [MatIconModule, PageHeader, CheckoutModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans">
      <app-page-header
        title="Paketler & Üyelik Yenileme"
        icon="card_membership"
        description="Salonumuzun sunduğu avantajlı üyelik paketleri. Dilediğiniz paketi kredi kartı veya e-cüzdan bakiyenizle online satın alabilirsiniz."
      />

      <!-- Mevcut Üyelik Bilgi Bandı -->
      @if (auth.profile()?.packageLabel) {
        <div class="odv-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 mb-6 border-l-4 border-l-indigo-600">
          <div class="flex items-center gap-4">
            <span class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 shadow-sm">
              <mat-icon class="icon-size-6">verified</mat-icon>
            </span>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">AKTİF ÜYELİK</span>
                @if (auth.profile()?.membershipStatus === 'active') {
                  <span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Geçerli
                  </span>
                }
              </div>
              <h3 class="m-0 text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {{ auth.profile()?.packageLabel }}
              </h3>
              @if (auth.profile()?.membershipEndsAt) {
                <p class="m-0 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Bitiş Tarihi: <b>{{ date(auth.profile()?.membershipEndsAt) }}</b>
                </p>
              }
            </div>
          </div>

          <div class="flex items-center gap-2">
            <div class="text-right hidden sm:block">
              <span class="text-xs text-slate-500 dark:text-slate-400 block">Cüzdan Bakiyeniz</span>
              <span class="text-sm font-bold text-slate-900 dark:text-white">
                ₺{{ (auth.profile()?.walletBalance ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) }}
              </span>
            </div>
          </div>
        </div>
      }

      @if (packages() === null) {
        <p class="py-16 text-center text-sm text-slate-500 dark:text-slate-400 m-0">Paketler yükleniyor…</p>
      } @else if (packages()!.length === 0) {
        <div class="odv-card py-16 text-center">
          <mat-icon class="icon-size-10 text-slate-300 dark:text-slate-600 mb-2">inventory_2</mat-icon>
          <p class="m-0 text-sm font-semibold text-slate-700 dark:text-slate-300">Henüz yayınlanmış paket bulunmuyor.</p>
          <p class="m-0 text-xs text-slate-500 dark:text-slate-400 mt-1">Salon yönetimi paketleri açtığında burada görüntülenecektir.</p>
        </div>
      } @else {
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          @for (pkg of packages(); track pkg.id) {
            <div class="odv-card flex flex-col p-6 relative transition-all duration-200 hover:shadow-xl hover:-translate-y-1"
                 [class.border-indigo-500]="isPopular(pkg)"
                 [class.ring-2]="isPopular(pkg)"
                 [class.ring-indigo-500/20]="isPopular(pkg)">

              <!-- Popüler Rozeti -->
              @if (isPopular(pkg)) {
                <div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                  <mat-icon class="icon-size-3">star</mat-icon>
                  <span>En Çok Tercih Edilen</span>
                </div>
              }

              <div class="flex items-start justify-between gap-2 mt-1">
                <div>
                  <h4 class="m-0 text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {{ pkg.name }}
                  </h4>
                  <span class="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    {{ pkg.durationDays }} Günlük Erişim
                  </span>
                </div>
                <span class="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg whitespace-nowrap">
                  ₺{{ dailyCost(pkg) }}/gün
                </span>
              </div>

              <!-- Fiyat -->
              <div class="my-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <p class="m-0 text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-baseline gap-1">
                  {{ money(pkg.price) }}
                  <span class="text-xs font-semibold text-slate-400">/ toplam</span>
                </p>
                @if (pkg.description) {
                  <p class="m-0 text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {{ pkg.description }}
                  </p>
                }
              </div>

              <!-- Avantajlar Listesi -->
              <ul class="list-none m-0 mb-6 p-0 flex flex-col gap-2.5 flex-1 text-xs">
                @for (perk of pkg.features; track perk) {
                  <li class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <mat-icon class="icon-size-4 text-emerald-500 flex-shrink-0">check_circle</mat-icon>
                    <span>{{ perk }}</span>
                  </li>
                }
                @if (!pkg.features || pkg.features.length === 0) {
                  <li class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <mat-icon class="icon-size-4 text-emerald-500 flex-shrink-0">check_circle</mat-icon>
                    <span>Tüm fitness ekipmanlarına sınırsız erişim</span>
                  </li>
                  <li class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <mat-icon class="icon-size-4 text-emerald-500 flex-shrink-0">check_circle</mat-icon>
                    <span>Akıllı QR Turnike Geçiş Kartı</span>
                  </li>
                }
              </ul>

              <!-- Satın Al Butonu -->
              <button type="button"
                      class="odv-btn-primary w-full !py-3 font-bold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
                      (click)="openCheckout(pkg)">
                <mat-icon class="icon-size-4.5">shopping_cart</mat-icon>
                <span>Hemen Satın Al</span>
              </button>
            </div>
          }
        </div>
      }

      <!-- Güvenli Ödeme Modalı -->
      <app-checkout-modal
        [open]="checkoutOpen()"
        [mode]="'package'"
        [selectedPackage]="selectedPackage()"
        (closed)="checkoutOpen.set(false)"
        (paymentSuccess)="onPaymentSuccess($event)"
      />
    </div>
  `,
})
export class Packages {
  protected readonly auth = inject(AuthService);
  private readonly service = inject(UserPackagesService);
  private readonly alert = inject(AlertService);

  protected readonly money = formatMoney;
  protected readonly date = formatDate;

  protected readonly selectedPackage = signal<GymPackage | null>(null);
  protected readonly checkoutOpen = signal<boolean>(false);

  private readonly data = toSignal(this.service.watchAvailablePackages(), { initialValue: null });
  protected readonly packages = computed(() => {
    const list = this.data();
    return list && [...list].sort((a, b) => a.durationDays - b.durationDays);
  });

  isPopular(pkg: GymPackage): boolean {
    return pkg.durationDays === 365 || pkg.durationDays === 180 || pkg.price >= 8000;
  }

  dailyCost(pkg: GymPackage): number {
    if (!pkg.durationDays || pkg.durationDays <= 0) return 0;
    return Math.round(pkg.price / pkg.durationDays);
  }

  openCheckout(pkg: GymPackage): void {
    this.selectedPackage.set(pkg);
    this.checkoutOpen.set(true);
  }

  onPaymentSuccess(result: any): void {
    this.alert.success(result.message || 'Paket satın alma işlemi başarıyla tamamlandı!');
  }
}
