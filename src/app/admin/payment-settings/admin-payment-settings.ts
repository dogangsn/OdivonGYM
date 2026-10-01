import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { GymPaymentSettings, IyzicoMode, PaymentSettingsApi } from '../../core/api/payment-settings.api';
import { AlertService } from '../../core/services/alert.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { toAppError } from '../../shared/models/app-error.model';
import { formatDateTime } from '../../shared/ui/ui-utils';

/**
 * Salonun iyzico anahtarları: üyelerin kartla ödemeleri (paket, bakiye, taksit) bu hesaba geçer.
 * Anahtarlar sunucuda şifreli saklanır ve geri gösterilmez; değiştirmek için yeniden girilir.
 */
@Component({
  selector: 'app-admin-payment-settings',
  standalone: true,
  imports: [FormsModule, MatIconModule, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans space-y-5">
      <app-page-header
        title="Online Ödeme (iyzico)"
        icon="credit_card"
        description="Üyeleriniz paket, bakiye ve taksitlerini kartla ödediğinde para kendi iyzico hesabınıza geçer."
      />

      @if (error()) {
        <p class="m-0 text-xs text-rose-600">{{ error() }}</p>
      }

      <div class="odv-card p-5 space-y-4 max-w-2xl">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="odv-badge" [class]="statusClass()">{{ statusLabel() }}</span>
            @if (settings()?.configured) {
              <span class="text-xs text-slate-500">
                API: <b>{{ settings()!.apiKeyHint }}</b> · Secret: <b>{{ settings()!.secretKeyHint }}</b>
              </span>
            }
          </div>
          @if (settings()?.configured) {
            <label class="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" [ngModel]="settings()!.enabled" (ngModelChange)="toggle($event)" [disabled]="busy()" />
              Kartla ödeme açık
            </label>
          }
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="text-xs font-bold text-slate-600 dark:text-slate-300">
            API Key
            <input type="text" class="odv-input mt-1" autocomplete="off" [(ngModel)]="apiKey"
                   [placeholder]="settings()?.configured ? 'Değiştirmek için yeni anahtarı girin' : 'iyzico API anahtarı'" />
          </label>
          <label class="text-xs font-bold text-slate-600 dark:text-slate-300">
            Secret Key
            <input type="password" class="odv-input mt-1" autocomplete="new-password" [(ngModel)]="secretKey"
                   [placeholder]="settings()?.configured ? 'Değiştirmek için yeni anahtarı girin' : 'iyzico gizli anahtarı'" />
          </label>
        </div>

        <div class="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600 dark:text-slate-300">
          <span>Ortam:</span>
          <label class="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="mode" value="sandbox" [ngModel]="mode()" (ngModelChange)="mode.set($event)" /> Test (sandbox)
          </label>
          <label class="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="mode" value="live" [ngModel]="mode()" (ngModelChange)="mode.set($event)" /> Canlı
          </label>
        </div>
        @if (mode() === 'live') {
          <p class="m-0 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
            Canlı ortamda üyelerin kartlarından gerçek çekim yapılır. Önce test ortamında deneyin.
          </p>
        }

        <div class="flex flex-wrap gap-2">
          <button type="button" class="odv-btn-primary" [disabled]="busy()" (click)="save()">Kaydet</button>
          <button type="button" class="odv-btn-soft" [disabled]="busy()" (click)="test()">
            <mat-icon class="icon-size-4">wifi_tethering</mat-icon>
            Bağlantıyı test et
          </button>
          @if (settings()?.configured) {
            <button type="button" class="odv-btn-soft !text-rose-600" [disabled]="busy()" (click)="remove()">Anahtarları sil</button>
          }
        </div>

        @if (testResult(); as t) {
          <p class="m-0 text-xs" [class]="t.ok ? 'text-emerald-700' : 'text-rose-600'">
            {{ t.ok ? 'Bağlantı başarılı (' + (t.mode === 'live' ? 'canlı' : 'test') + ' ortamı).' : 'Bağlantı başarısız: ' + (t.message || 'iyzico anahtarları reddetti.') }}
          </p>
        } @else if (settings()?.lastTest; as last) {
          <p class="m-0 text-[11px] text-slate-500">
            Son test: {{ date(last.at) }} · {{ last.ok ? 'başarılı' : 'başarısız' + (last.message ? ' (' + last.message + ')' : '') }}
          </p>
        }

        <p class="m-0 text-[11px] text-slate-400">
          Anahtarları iyzico merchant panelinde Ayarlar → Firma Ayarları bölümünde bulabilirsiniz. Test, ödeme yapmadan
          yalnızca anahtarların geçerliliğini kontrol eder. Anahtarlar şifreli saklanır ve bir daha gösterilmez.
        </p>
      </div>
    </div>
  `,
})
export class AdminPaymentSettings {
  private readonly api = inject(PaymentSettingsApi);
  private readonly alert = inject(AlertService);

  protected readonly date = formatDateTime;
  protected readonly settings = signal<GymPaymentSettings | null>(null);
  protected readonly mode = signal<IyzicoMode>('sandbox');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly testResult = signal<{ ok: boolean; message: string | null; mode: IyzicoMode } | null>(null);
  protected apiKey = '';
  protected secretKey = '';

  constructor() {
    void this.load();
  }

  protected statusLabel(): string {
    const s = this.settings();
    if (!s?.configured) return 'Tanımlı değil';
    if (!s.enabled) return 'Kapalı';
    return s.mode === 'live' ? 'Açık · Canlı' : 'Açık · Test';
  }

  protected statusClass(): string {
    const s = this.settings();
    if (!s?.configured || !s.enabled) return 'bg-slate-100 text-slate-600';
    return s.mode === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700';
  }

  protected async save(): Promise<void> {
    const apiKey = this.apiKey.trim();
    const secretKey = this.secretKey.trim();
    if (!this.settings()?.configured && (!apiKey || !secretKey)) {
      this.alert.toastError('API Key ve Secret Key girin.');
      return;
    }
    if (Boolean(apiKey) !== Boolean(secretKey)) {
      this.alert.toastError('Anahtarları birlikte girin.');
      return;
    }
    await this.run(async () => {
      this.settings.set(
        await firstValueFrom(this.api.save({ ...(apiKey ? { apiKey, secretKey } : {}), mode: this.mode() })),
      );
      this.apiKey = '';
      this.secretKey = '';
      this.testResult.set(null);
      this.alert.toastSuccess('iyzico ayarları kaydedildi.');
    });
  }

  protected async toggle(enabled: boolean): Promise<void> {
    await this.run(async () => this.settings.set(await firstValueFrom(this.api.save({ enabled }))));
  }

  protected async test(): Promise<void> {
    const apiKey = this.apiKey.trim();
    const secretKey = this.secretKey.trim();
    await this.run(async () => {
      this.testResult.set(
        await firstValueFrom(this.api.test(apiKey && secretKey ? { apiKey, secretKey, mode: this.mode() } : { mode: this.mode() })),
      );
      if (!apiKey) this.settings.set(await firstValueFrom(this.api.get()));
    });
  }

  protected async remove(): Promise<void> {
    if (!(await this.alert.deleteConfirm('iyzico anahtarları'))) return;
    await this.run(async () => {
      this.settings.set(await firstValueFrom(this.api.remove()));
      this.testResult.set(null);
    });
  }

  private async load(): Promise<void> {
    await this.run(async () => {
      const settings = await firstValueFrom(this.api.get());
      this.settings.set(settings);
      this.mode.set(settings.mode);
    });
  }

  private async run(work: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await work();
    } catch (err) {
      this.error.set(toAppError(err).message || 'İşlem tamamlanamadı.');
    } finally {
      this.busy.set(false);
    }
  }
}
