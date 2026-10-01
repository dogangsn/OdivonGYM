import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import {
  GymReminder,
  ReminderRunResult,
  ReminderSettings,
  RemindersApi,
  ReminderType,
} from '../../core/api/reminders.api';
import { AlertService } from '../../core/services/alert.service';
import { PermissionService } from '../../core/services/permission.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { toAppError } from '../../shared/models/app-error.model';
import { formatDateTime } from '../../shared/ui/ui-utils';
import { gymToday } from '../receivables/installment-math';

const TYPE_LABEL: Record<ReminderType, string> = {
  membership_expiring: 'Üyelik bitiyor',
  installment_overdue: 'Geciken taksit',
  inactive_member: 'Gelmeyen üye',
};

const TYPE_CLASS: Record<ReminderType, string> = {
  membership_expiring: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  installment_overdue: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  inactive_member: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
};

const SMS_LABEL: Record<GymReminder['sms'], string> = {
  disabled: 'SMS kapalı',
  no_phone: 'Telefon yok',
  sent: 'SMS gönderildi',
  failed: 'SMS başarısız',
};

const TYPES: ReminderType[] = ['membership_expiring', 'installment_overdue', 'inactive_member'];

@Component({
  selector: 'app-admin-reminders',
  standalone: true,
  imports: [FormsModule, MatIconModule, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans space-y-6">
      <app-page-header
        title="Hatırlatmalar"
        icon="notifications_active"
        description="Üyelik bitişi, geciken taksit ve uzun süre gelmeyen üyeler için her sabah 08:00'de otomatik hatırlatma."
      >
        @if (permissions.isAdmin()) {
          <div actions class="flex items-center gap-2">
            <button type="button" class="odv-btn-soft" (click)="run(true)" [disabled]="busy()">
              <mat-icon class="icon-size-4">visibility</mat-icon>
              <span>Önizle</span>
            </button>
            <button type="button" class="odv-btn-primary" (click)="run(false)" [disabled]="busy()">
              <mat-icon class="icon-size-4">play_arrow</mat-icon>
              <span>Şimdi Çalıştır</span>
            </button>
          </div>
        }
      </app-page-header>

      <!-- Günün listesi -->
      <section class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <input class="odv-input" type="date" [ngModel]="day()" (ngModelChange)="setDay($event)" />
          <button type="button" class="px-3 py-2 rounded-xl text-xs font-bold cursor-pointer"
                  [class]="typeFilter() === '' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'"
                  (click)="typeFilter.set('')">Tümü ({{ items().length }})</button>
          @for (t of types; track t) {
            <button type="button" class="px-3 py-2 rounded-xl text-xs font-bold cursor-pointer"
                    [class]="typeFilter() === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'"
                    (click)="typeFilter.set(t)">{{ typeLabel[t] }} ({{ count(t) }})</button>
          }
        </div>

        <div class="odv-card overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-slate-50 dark:bg-slate-800/60">
                <th class="odv-th text-left">Üye</th>
                <th class="odv-th text-left">Tür</th>
                <th class="odv-th text-left">Mesaj</th>
                <th class="odv-th text-left">Kanal</th>
              </tr>
            </thead>
            <tbody>
              @for (r of filtered(); track r.id) {
                <tr class="border-t border-slate-100 dark:border-slate-800 align-top">
                  <td class="odv-td">
                    <div class="font-bold text-slate-900 dark:text-white">{{ r.memberName }}</div>
                    @if (r.phone) { <a class="text-[11px] text-indigo-600" [href]="'tel:' + r.phone">{{ r.phone }}</a> }
                  </td>
                  <td class="odv-td"><span class="odv-badge" [class]="typeClass[r.type]">{{ typeLabel[r.type] }}</span></td>
                  <td class="odv-td">
                    <div class="font-semibold text-slate-800 dark:text-slate-100">{{ r.title }}</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">{{ r.body }}</div>
                  </td>
                  <td class="odv-td text-xs text-slate-500 whitespace-nowrap">
                    Uygulama içi · {{ smsLabel[r.sms] }}
                    <div class="text-[10px] text-slate-400">{{ dateTime(r.createdAt) }}</div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="odv-td text-center text-slate-400 py-10">{{ loading() ? 'Yükleniyor…' : 'Bu gün için hatırlatma yok.' }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- Önizleme sonucu -->
      @if (lastRun(); as run) {
        <section class="odv-card p-4 space-y-2 text-sm">
          <p class="m-0 font-black text-slate-900 dark:text-white">
            {{ run.dryRun ? 'Önizleme' : 'Çalıştırma' }} · {{ run.day }}
          </p>
          <p class="m-0 text-xs text-slate-500">
            {{ run.dryRun ? 'Gönderilecek' : 'Oluşturulan' }}: <b>{{ run.dryRun ? run.preview?.length ?? 0 : run.created }}</b>
            · Daha önce gönderildiği için atlanan: <b>{{ run.skippedExisting }}</b>
            @if (!run.enabled) { · <span class="text-amber-600 font-bold">Hatırlatmalar kapalı</span> }
          </p>
          @if (run.preview?.length) {
            <ul class="m-0 p-0 list-none divide-y divide-slate-100 dark:divide-slate-800">
              @for (p of run.preview; track $index) {
                <li class="py-2 text-xs"><b>{{ p.memberName }}</b> · {{ typeLabel[p.type] }} — {{ p.body }}</li>
              }
            </ul>
          }
        </section>
      }

      <!-- Ayarlar -->
      @if (settings(); as s) {
        <section class="odv-card p-5 space-y-5">
          <div class="flex items-center justify-between">
            <h3 class="m-0 text-base font-black text-slate-900 dark:text-white">Ayarlar ve Mesaj Şablonları</h3>
            @if (!permissions.isAdmin()) { <span class="text-xs text-slate-400">Yalnız yöneticiler değiştirebilir</span> }
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label class="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" [disabled]="!permissions.isAdmin()" [ngModel]="s.enabled" (ngModelChange)="patch({ enabled: $event })" />
              Otomatik hatırlatmalar açık
            </label>
            <label class="flex items-start gap-2 text-sm font-semibold">
              <input type="checkbox" class="mt-1" [disabled]="!permissions.isAdmin()" [ngModel]="s.smsEnabled" (ngModelChange)="patch({ smsEnabled: $event })" />
              <span>
                Hatırlatmayı SMS ile de gönder
                <span class="block text-[11px] font-normal text-slate-500">Varsayılan kapalı. SMS ayarlarındaki sağlayıcı kullanılır; sağlayıcı bağlı değilse gönderim simüle edilir.</span>
              </span>
            </label>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300">
              Üyelik bitişine kalan gün (virgülle)
              <input class="odv-input mt-1 w-full" [disabled]="!permissions.isAdmin()" [ngModel]="s.expiryDays.join(', ')" (change)="patch({ expiryDays: toDays($any($event.target).value) })" />
            </label>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300">
              Taksit gecikme günü (virgülle)
              <input class="odv-input mt-1 w-full" [disabled]="!permissions.isAdmin()" [ngModel]="s.overdueDays.join(', ')" (change)="patch({ overdueDays: toDays($any($event.target).value) })" />
            </label>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300">
              Kaç gün gelmeyen üyeye hatırlatılsın
              <input class="odv-input mt-1 w-full" type="number" min="3" max="90" [disabled]="!permissions.isAdmin()" [ngModel]="s.inactiveDays" (change)="patch({ inactiveDays: +$any($event.target).value })" />
            </label>
          </div>

          <p class="m-0 text-[11px] text-slate-500">
            Şablonlarda kullanılabilir: <code>{{ '{ad}' }}</code> <code>{{ '{gun}' }}</code> <code>{{ '{paket}' }}</code> <code>{{ '{bitis}' }}</code>
            <code>{{ '{tutar}' }}</code> <code>{{ '{vade}' }}</code> <code>{{ '{gecikme}' }}</code>
          </p>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            @for (t of types; track t) {
              <div class="space-y-2">
                <span class="odv-badge" [class]="typeClass[t]">{{ typeLabel[t] }}</span>
                <input class="odv-input w-full" maxlength="120" [disabled]="!permissions.isAdmin()"
                       [ngModel]="s.templates[t].title" (change)="patchTemplate(t, 'title', $any($event.target).value)" />
                <textarea class="odv-input w-full min-h-[96px]" maxlength="480" [disabled]="!permissions.isAdmin()"
                          [ngModel]="s.templates[t].body" (change)="patchTemplate(t, 'body', $any($event.target).value)"></textarea>
              </div>
            }
          </div>
        </section>
      }
    </div>
  `,
})
export class AdminReminders {
  private readonly api = inject(RemindersApi);
  private readonly alert = inject(AlertService);
  protected readonly permissions = inject(PermissionService);

  protected readonly types = TYPES;
  protected readonly typeLabel = TYPE_LABEL;
  protected readonly typeClass = TYPE_CLASS;
  protected readonly smsLabel = SMS_LABEL;
  protected readonly dateTime = formatDateTime;

  protected readonly day = signal(gymToday());
  protected readonly typeFilter = signal<ReminderType | ''>('');
  protected readonly items = signal<GymReminder[]>([]);
  protected readonly settings = signal<ReminderSettings | null>(null);
  protected readonly lastRun = signal<ReminderRunResult | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);

  protected readonly filtered = computed(() => {
    const t = this.typeFilter();
    return t ? this.items().filter((r) => r.type === t) : this.items();
  });

  constructor() {
    void this.load();
    void this.loadSettings();
  }

  protected count(type: ReminderType): number {
    return this.items().filter((r) => r.type === type).length;
  }

  protected setDay(day: string): void {
    this.day.set(day || gymToday());
    void this.load();
  }

  protected toDays(text: string): number[] {
    return [...new Set(text.split(/[,\s]+/).map((x) => Math.trunc(Number(x))).filter((n) => Number.isFinite(n) && n >= 0))];
  }

  protected async run(dryRun: boolean): Promise<void> {
    if (!dryRun) {
      const ok = await this.alert.confirm({
        title: 'Hatırlatmalar şimdi gönderilsin mi?',
        message: 'Bugün için gönderilmemiş hatırlatmalar üyelere uygulama içi bildirim olarak iletilir (SMS ayarı açıksa SMS de). Aynı hatırlatma ikinci kez gönderilmez.',
        icon: 'question',
        confirmText: 'Gönder',
      });
      if (!ok) return;
    }
    this.busy.set(true);
    try {
      this.lastRun.set(await firstValueFrom(this.api.run(dryRun)));
      if (!dryRun) await this.load();
    } catch (err) {
      this.alert.toastError(toAppError(err).message || 'Çalıştırılamadı.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async patch(change: Partial<ReminderSettings>): Promise<void> {
    try {
      this.settings.set(await firstValueFrom(this.api.saveSettings(change)));
      this.alert.toastSuccess('Ayar kaydedildi.');
    } catch (err) {
      this.alert.toastError(toAppError(err).message || 'Ayar kaydedilemedi.');
      await this.loadSettings();
    }
  }

  protected patchTemplate(type: ReminderType, field: 'title' | 'body', value: string): void {
    const text = value.trim();
    if (!text) return;
    void this.patch({ templates: { [type]: { [field]: text } } } as unknown as Partial<ReminderSettings>);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.items.set(await firstValueFrom(this.api.list(this.day())));
    } catch (err) {
      this.alert.toastError(toAppError(err).message || 'Hatırlatmalar yüklenemedi.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      this.settings.set(await firstValueFrom(this.api.settings()));
    } catch {
      this.settings.set(null);
    }
  }
}
