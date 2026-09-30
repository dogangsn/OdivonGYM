import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { AdminMembersService } from '../../../admin/members/admin-members.service';
import { AdminPackagesService } from '../../../admin/packages/admin-packages.service';
import {
  addMonths,
  formatDay,
  gymToday,
  previewSchedule,
  receivableErrorMessage,
  toKurus,
  toTl,
} from '../../../admin/receivables/installment-math';
import { ReceivablesApi } from '../../../core/api/receivables.api';
import { WalletApi } from '../../../core/api/wallet.api';
import { GymPackage } from '../../../core/models/gym-package.model';
import { AlertService } from '../../../core/services/alert.service';
import {
  Receivable,
  RECEIVABLE_PAYMENT_LABELS,
  ReceivablePaymentMethod,
} from '../../../core/models/receivable.model';
import { UserProfile } from '../../../core/models/user-profile.model';
import { formatMoney } from '../../ui/ui-utils';

const COUNT_PRESETS = [2, 3, 4, 6, 9, 12];

/**
 * Paketi peşinat + aylık taksitle satar. Fiyat ve süre sunucuda paketten alınır; buradaki
 * önizleme yalnızca personele planı göstermek içindir.
 */
@Component({
  selector: 'app-installment-sale-dialog',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50" (click)="onBackdropClick()"></div>
      <div class="font-sans fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          class="pointer-events-auto w-full max-w-3xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800"
        >
          <div class="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                <mat-icon class="icon-size-5">event_repeat</mat-icon>
              </div>
              <div>
                <h3 class="m-0 text-base font-black text-slate-900 dark:text-white">Taksitli / Kısmi Ödemeli Satış</h3>
                <p class="m-0 text-xs text-slate-500">Üyelik hemen başlar; kalan tutar aylık taksitlerle takip edilir.</p>
              </div>
            </div>
            <button type="button" class="odv-icon-btn" (click)="close()" aria-label="Kapat">
              <mat-icon class="icon-size-5">close</mat-icon>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5 custom-scroll">
            <div class="space-y-4">
              @if (error()) {
                <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                  {{ error() }}
                </div>
              }

              <label class="block">
                <span class="text-xs font-bold text-slate-600 dark:text-slate-300">Üye</span>
                @if (member(); as m) {
                  <div class="mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100">
                    {{ m.displayName }} <span class="text-xs text-slate-400">#{{ m.memberNumber || m.uid.slice(0, 5) }}</span>
                  </div>
                } @else {
                  <select class="odv-input mt-1 w-full" [ngModel]="memberId()" (ngModelChange)="memberId.set($event)" name="member">
                    <option value="">Üye seçin…</option>
                    @for (m of members(); track m.uid) {
                      <option [value]="m.uid">{{ m.displayName }} (#{{ m.memberNumber || m.uid.slice(0, 5) }})</option>
                    }
                  </select>
                }
              </label>

              <label class="block">
                <span class="text-xs font-bold text-slate-600 dark:text-slate-300">Paket</span>
                @if (gymPackage(); as p) {
                  <div class="mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100">
                    {{ p.name }} · {{ p.durationDays }} gün · {{ money(p.price) }}
                  </div>
                } @else {
                  <select class="odv-input mt-1 w-full" [ngModel]="packageId()" (ngModelChange)="packageId.set($event)" name="package">
                    <option value="">Paket seçin…</option>
                    @for (p of packages(); track p.id) {
                      <option [value]="p.id">{{ p.name }} · {{ money(p.price) }}</option>
                    }
                  </select>
                }
              </label>

              <div class="grid grid-cols-2 gap-3">
                <label class="block">
                  <span class="text-xs font-bold text-slate-600 dark:text-slate-300">İndirim (₺)</span>
                  <input class="odv-input mt-1 w-full" type="number" min="0" step="0.01" name="discount"
                         [ngModel]="discount()" (ngModelChange)="discount.set(+$event || 0)" />
                </label>
                <label class="block">
                  <span class="text-xs font-bold text-slate-600 dark:text-slate-300">Peşinat (₺)</span>
                  <input class="odv-input mt-1 w-full" type="number" min="0" step="0.01" name="down"
                         [ngModel]="downPayment()" (ngModelChange)="downPayment.set(+$event || 0)" />
                </label>
              </div>

              <div>
                <span class="text-xs font-bold text-slate-600 dark:text-slate-300">Taksit sayısı</span>
                <div class="mt-1 flex flex-wrap items-center gap-1.5">
                  @for (n of countPresets; track n) {
                    <button type="button" (click)="installmentCount.set(n)"
                            class="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border"
                            [class]="installmentCount() === n
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'">
                      {{ n }}
                    </button>
                  }
                  <input class="odv-input w-20" type="number" min="1" max="36" name="count"
                         [ngModel]="installmentCount()" (ngModelChange)="installmentCount.set(clampCount($event))" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <label class="block">
                  <span class="text-xs font-bold text-slate-600 dark:text-slate-300">İlk taksit vadesi</span>
                  <input class="odv-input mt-1 w-full" type="date" name="firstDue" [min]="today"
                         [ngModel]="firstDueDate()" (ngModelChange)="firstDueDate.set($event)" />
                </label>
                <label class="block">
                  <span class="text-xs font-bold text-slate-600 dark:text-slate-300">Peşinat ödeme yöntemi</span>
                  <select class="odv-input mt-1 w-full" name="method" [ngModel]="paymentMethod()" (ngModelChange)="paymentMethod.set($event)"
                          [disabled]="toKurus(downPayment()) === 0">
                    @for (m of methods; track m) {
                      <option [value]="m">{{ methodLabels[m] }}</option>
                    }
                  </select>
                </label>
              </div>

              <label class="block">
                <span class="text-xs font-bold text-slate-600 dark:text-slate-300">Not</span>
                <input class="odv-input mt-1 w-full" type="text" maxlength="500" name="notes"
                       [ngModel]="notes()" (ngModelChange)="notes.set($event)" placeholder="Örn. senet no, kefil…" />
              </label>
            </div>

            <div class="space-y-3">
              <div class="odv-card p-4 space-y-1.5 text-xs">
                <div class="flex justify-between"><span class="text-slate-500">Paket fiyatı</span><span class="font-bold">{{ money(listPrice()) }}</span></div>
                @if (toKurus(discount()) > 0) {
                  <div class="flex justify-between"><span class="text-slate-500">İndirim</span><span class="font-bold text-rose-600">-{{ money(discount()) }}</span></div>
                }
                <div class="flex justify-between"><span class="text-slate-500">Satış tutarı</span><span class="font-black">{{ money(total()) }}</span></div>
                <div class="flex justify-between"><span class="text-slate-500">Peşinat</span><span class="font-bold text-emerald-600">{{ money(downPayment()) }}</span></div>
                <div class="flex justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
                  <span class="text-slate-500">Taksitlendirilen</span><span class="font-black text-indigo-600">{{ money(financed()) }}</span>
                </div>
              </div>

              @if (schedule().length > 0) {
                <div class="odv-card overflow-hidden">
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="bg-slate-50 dark:bg-slate-800/60">
                        <th class="odv-th text-left">#</th>
                        <th class="odv-th text-left">Vade</th>
                        <th class="odv-th text-right">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of schedule(); track row.no) {
                        <tr class="border-t border-slate-100 dark:border-slate-800">
                          <td class="odv-td">{{ row.no }}/{{ schedule().length }}</td>
                          <td class="odv-td">{{ day(row.dueDate) }}</td>
                          <td class="odv-td text-right font-bold">{{ money(row.amount) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <p class="text-xs text-slate-400 m-0">Üye, paket ve tutarları girince ödeme planı burada görünür.</p>
              }
            </div>
          </div>

          <div class="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button type="button" class="odv-btn-ghost" (click)="close()">Vazgeç</button>
            <button type="button" class="odv-btn-primary" [disabled]="!canSubmit() || saving()" (click)="submit()">
              <mat-icon class="icon-size-4">check</mat-icon>
              <span>{{ saving() ? 'Kaydediliyor…' : 'Satışı Tamamla' }}</span>
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class InstallmentSaleDialog {
  private readonly api = inject(ReceivablesApi);
  private readonly walletApi = inject(WalletApi);
  private readonly membersService = inject(AdminMembersService);
  private readonly packagesService = inject(AdminPackagesService);
  private readonly alertService = inject(AlertService);

  /** Dışarıdan sabitlenen üye / paket; verilmezse diyalog içinde seçilir. */
  readonly open = input(false);
  readonly member = input<UserProfile | null>(null);
  readonly gymPackage = input<GymPackage | null>(null);
  readonly closed = output<void>();
  readonly completed = output<Receivable>();

  protected readonly money = formatMoney;
  protected readonly day = formatDay;
  protected readonly toKurus = toKurus;
  protected readonly countPresets = COUNT_PRESETS;
  protected readonly methods: ReceivablePaymentMethod[] = ['cash', 'card', 'transfer', 'wallet'];
  protected readonly methodLabels = RECEIVABLE_PAYMENT_LABELS;
  protected readonly today = gymToday();

  private readonly allMembers = toSignal(this.membersService.watchMembers(), { initialValue: [] as UserProfile[] });
  private readonly allPackages = toSignal(this.packagesService.watchPackages(), { initialValue: [] as GymPackage[] });
  protected readonly members = computed(() =>
    this.allMembers()
      .filter((m) => !m.isArchived)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr')),
  );
  protected readonly packages = computed(() => this.allPackages().filter((p) => p.status === 'active'));

  protected readonly memberId = signal('');
  protected readonly packageId = signal('');
  protected readonly discount = signal(0);
  protected readonly downPayment = signal(0);
  protected readonly installmentCount = signal(3);
  protected readonly firstDueDate = signal(addMonths(gymToday(), 1));
  protected readonly paymentMethod = signal<ReceivablePaymentMethod>('cash');
  protected readonly notes = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  private readonly selectedPackage = computed(
    () => this.gymPackage() ?? this.packages().find((p) => p.id === this.packageId()) ?? null,
  );
  private readonly selectedMemberId = computed(() => this.member()?.uid ?? this.memberId());

  protected readonly listPrice = computed(() => this.selectedPackage()?.price ?? 0);
  protected readonly total = computed(() => toTl(Math.max(0, toKurus(this.listPrice()) - toKurus(this.discount()))));
  protected readonly financed = computed(() => toTl(Math.max(0, toKurus(this.total()) - toKurus(this.downPayment()))));
  protected readonly schedule = computed(() =>
    previewSchedule(this.financed(), this.installmentCount(), this.firstDueDate()),
  );
  protected readonly canSubmit = computed(
    () =>
      !!this.selectedMemberId() &&
      !!this.selectedPackage() &&
      toKurus(this.financed()) > 0 &&
      this.firstDueDate() >= this.today &&
      this.installmentCount() >= 1 &&
      this.installmentCount() <= 36,
  );

  constructor() {
    // Her açılışta formu sıfırla.
    effect(() => {
      if (!this.open()) return;
      this.memberId.set('');
      this.packageId.set('');
      this.discount.set(0);
      this.downPayment.set(0);
      this.installmentCount.set(3);
      this.firstDueDate.set(addMonths(gymToday(), 1));
      this.paymentMethod.set('cash');
      this.notes.set('');
      this.error.set('');
    });
  }

  protected clampCount(value: unknown): number {
    const n = Math.trunc(Number(value) || 1);
    return Math.min(36, Math.max(1, n));
  }

  protected close(): void {
    if (!this.saving()) this.closed.emit();
  }

  protected async submit(): Promise<void> {
    const pkg = this.selectedPackage();
    const userId = this.selectedMemberId();
    if (!pkg || !userId || !this.canSubmit()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const plan = await firstValueFrom(
        this.api.createSale({
          userId,
          packageId: pkg.id,
          downPayment: this.downPayment(),
          installmentCount: this.installmentCount(),
          firstDueDate: this.firstDueDate(),
          discount: toKurus(this.discount()) > 0 ? this.discount() : undefined,
          paymentMethod: this.paymentMethod(),
          notes: this.notes().trim() || undefined,
        }),
      );

      // Kalan borcu üyenin cüzdanına yansıt
      const financedAmount = this.financed();
      if (financedAmount > 0) {
        try {
          await firstValueFrom(
            this.walletApi.adjust({
              userId,
              walletType: 'debit',
              amount: financedAmount,
              description: `Taksitli paket satışı kalan borcu: ${pkg.name}`,
              paymentMethod: this.paymentMethod(),
            }),
          );
        } catch (walletErr) {
          console.warn('Cüzdan borç kaydı oluşturulurken hata:', walletErr);
        }
      }

      this.completed.emit(plan);
    } catch (err) {
      this.error.set(receivableErrorMessage(err, 'Taksitli satış kaydedilemedi.'));
    } finally {
      this.saving.set(false);
    }
  }

  async onBackdropClick(): Promise<void> {
    const confirmed = await this.alertService.confirm({
      title: 'Kaydetmeden Çıkmak İstiyor Musunuz?',
      message: 'Girdiğiniz satış ve taksit bilgileri kaydedilmeyecektir. Çıkmak istediğinize emin misiniz?',
      icon: 'warning',
      confirmText: 'Evet, Çık',
      cancelText: 'Vazgeç',
      isDestructive: true,
    });
    if (confirmed) {
      this.close();
    }
  }
}
