import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { LeadsApi, ReferralSettings, ReferralSummary } from '../../core/api/leads.api';
import { UserProfile } from '../../core/models/user-profile.model';
import { AlertService } from '../../core/services/alert.service';
import { toAppError } from '../../shared/models/app-error.model';
import { formatDate } from '../../shared/ui/ui-utils';

/**
 * Tavsiye programı: ayarlar (varsayılan kapalı), verilen ödüller ve adaysız gelen bir üyeyi
 * tavsiye edene bağlama. Ödül sunucuda, yeni üye başına bir kez verilir.
 */
@Component({
  selector: 'app-referral-program',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <div class="odv-card p-5 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="m-0 text-sm font-bold text-slate-900 dark:text-white">Tavsiye Programı</h3>
            <p class="m-0 text-xs text-slate-500 mt-0.5">
              Tavsiye ettiği kişi üye olduğunda (aday "Üyeye Dönüştür" ile bağlandığında) tavsiye eden üyeye ödül verilir. Yeni üye başına bir kez.
            </p>
          </div>
          <label class="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" [ngModel]="draft().enabled" (ngModelChange)="patch({ enabled: $event })" />
            Program açık
          </label>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label class="text-xs font-bold text-slate-600 dark:text-slate-300">
            Ödül türü
            <select class="odv-input mt-1" [ngModel]="draft().rewardType" (ngModelChange)="patch({ rewardType: $event })">
              <option value="wallet">Cüzdana bakiye (TL)</option>
              <option value="days">Üyeliğe ek gün</option>
            </select>
          </label>
          @if (draft().rewardType === 'wallet') {
            <label class="text-xs font-bold text-slate-600 dark:text-slate-300">
              Tutar (TL)
              <input type="number" min="0" step="0.01" class="odv-input mt-1" [ngModel]="draft().rewardAmount" (ngModelChange)="patch({ rewardAmount: +$event })" />
            </label>
          } @else {
            <label class="text-xs font-bold text-slate-600 dark:text-slate-300">
              Gün
              <input type="number" min="0" max="365" class="odv-input mt-1" [ngModel]="draft().rewardDays" (ngModelChange)="patch({ rewardDays: +$event })" />
              <span class="block font-normal text-[11px] text-slate-400 mt-1">Yalnızca aktif üyeliğe eklenir; değilse ödül "bekliyor" olarak kalır.</span>
            </label>
          }
          <div class="flex items-end">
            <button type="button" class="odv-btn-primary" [disabled]="saving()" (click)="save()">Kaydet</button>
          </div>
        </div>
      </div>

      <div class="odv-card p-5 space-y-3">
        <h3 class="m-0 text-sm font-bold text-slate-900 dark:text-white">Adaysız gelen üyeyi bağla</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label class="text-xs font-bold text-slate-600 dark:text-slate-300">
            Tavsiye eden üye
            <select class="odv-input mt-1" [ngModel]="referrerId()" (ngModelChange)="referrerId.set($event)">
              <option value="">Seçin</option>
              @for (m of members(); track m.uid) {
                <option [value]="m.uid">{{ m.displayName }}</option>
              }
            </select>
          </label>
          <label class="text-xs font-bold text-slate-600 dark:text-slate-300">
            Yeni üye
            <select class="odv-input mt-1" [ngModel]="memberId()" (ngModelChange)="memberId.set($event)">
              <option value="">Seçin</option>
              @for (m of members(); track m.uid) {
                <option [value]="m.uid">{{ m.displayName }}</option>
              }
            </select>
          </label>
          <div class="flex items-end">
            <button type="button" class="odv-btn-soft" [disabled]="!referrerId() || !memberId() || referrerId() === memberId() || saving()" (click)="link()">Bağla</button>
          </div>
        </div>
      </div>

      <div class="odv-card overflow-x-auto">
        <p class="m-0 p-4 text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800">Verilen ödüller</p>
        @if (error()) {
          <p class="m-0 p-4 text-xs text-rose-600">{{ error() }}</p>
        }
        @if (summary()?.referrers?.length) {
          <div class="p-4 flex flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800">
            @for (r of summary()!.referrers; track r.referrerMemberId) {
              <span class="odv-badge bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                {{ r.referrerName }} · {{ r.referrals }} tavsiye
              </span>
            }
          </div>
        }
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-slate-50 dark:bg-slate-800/60">
              <th class="odv-th text-left">Tarih</th>
              <th class="odv-th text-left">Tavsiye eden</th>
              <th class="odv-th text-left">Yeni üye</th>
              <th class="odv-th text-left">Ödül</th>
              <th class="odv-th text-left">Durum</th>
            </tr>
          </thead>
          <tbody>
            @for (item of summary()?.items ?? []; track item.id) {
              <tr class="border-t border-slate-100 dark:border-slate-800">
                <td class="odv-td">{{ date(item.createdAt) }}</td>
                <td class="odv-td font-bold">{{ item.referrerName }}</td>
                <td class="odv-td">{{ item.referredName }}</td>
                <td class="odv-td">{{ item.type === 'wallet' ? item.amount + ' TL' : item.days + ' gün' }}</td>
                <td class="odv-td">
                  @if (item.status === 'granted') {
                    <span class="odv-badge bg-emerald-50 text-emerald-700">Verildi</span>
                  } @else {
                    <span class="odv-badge bg-amber-50 text-amber-700" [title]="item.note ?? ''">Bekliyor</span>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="odv-td text-center text-slate-400 py-6">Henüz tavsiye ödülü yok.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class ReferralProgram {
  private readonly api = inject(LeadsApi);
  private readonly alert = inject(AlertService);

  readonly allMembers = input<UserProfile[]>([]);
  protected readonly members = computed(() =>
    [...this.allMembers()].sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? '', 'tr')),
  );

  protected readonly date = formatDate;
  protected readonly draft = signal<ReferralSettings>({ enabled: false, rewardType: 'wallet', rewardAmount: 0, rewardDays: 0 });
  protected readonly summary = signal<ReferralSummary | null>(null);
  protected readonly error = signal('');
  protected readonly saving = signal(false);
  protected readonly referrerId = signal('');
  protected readonly memberId = signal('');

  constructor() {
    void this.load();
  }

  protected patch(change: Partial<ReferralSettings>): void {
    this.draft.update((current) => ({ ...current, ...change }));
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    try {
      this.draft.set(await firstValueFrom(this.api.saveReferralSettings(this.draft())));
      this.alert.toastSuccess('Tavsiye programı kaydedildi.');
    } catch (err) {
      this.alert.toastError(toAppError(err).message || 'Kaydedilemedi.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async link(): Promise<void> {
    this.saving.set(true);
    try {
      const result = await firstValueFrom(this.api.recordReferral(this.referrerId(), this.memberId()));
      this.alert.toastSuccess(result.reward ? 'Bağlandı, ödül tanımlandı.' : 'Bağlandı (ödül verilmedi: program kapalı veya daha önce verilmiş).');
      this.referrerId.set('');
      this.memberId.set('');
      await this.loadSummary();
    } catch (err) {
      this.alert.toastError(toAppError(err).message || 'Bağlanamadı.');
    } finally {
      this.saving.set(false);
    }
  }

  private async load(): Promise<void> {
    try {
      this.draft.set(await firstValueFrom(this.api.referralSettings()));
    } catch (err) {
      this.error.set(toAppError(err).message || 'Ayarlar yüklenemedi.');
    }
    await this.loadSummary();
  }

  private async loadSummary(): Promise<void> {
    try {
      this.summary.set(await firstValueFrom(this.api.referrals()));
    } catch (err) {
      this.error.set(toAppError(err).message || 'Ödüller yüklenemedi.');
    }
  }
}
