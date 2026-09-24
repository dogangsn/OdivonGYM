import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import * as QRCode from 'qrcode';
import { AuthService } from '../../../core/auth/auth.service';
import { AdminAccessControlService } from '../../../admin/access-control/admin-access-control.service';
import { MemberQrService } from './member-qr.service';

@Component({
  selector: 'app-member-qr-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (qrService.isOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
           (click)="onBackdropClick($event)">
        
        <div class="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative"
             (click)="$event.stopPropagation()">
          
          <!-- Üst Kart Header (Spor Kulübü Dijital Kart Tasarımı) -->
          <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white relative">
            <button type="button"
                    class="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
                    (click)="qrService.close()">
              <mat-icon class="icon-size-4">close</mat-icon>
            </button>

            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
                <mat-icon class="icon-size-5">qr_code_scanner</mat-icon>
              </div>
              <div>
                <span class="text-[10px] uppercase font-black tracking-widest text-indigo-300">{{ 'turnstileModal.badge' | transloco }}</span>
                <h3 class="m-0 text-base font-bold text-white leading-tight">{{ 'turnstileModal.title' | transloco }}</h3>
              </div>
            </div>

            <!-- Üye Künye Bilgisi -->
            <div class="mt-4 flex items-center gap-3 bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/10">
              @if (profile()?.photoURL) {
                <img [src]="profile()!.photoURL" [alt]="profile()?.displayName" class="w-12 h-12 rounded-full object-cover border-2 border-indigo-400" />
              } @else {
                <div class="w-12 h-12 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-lg border-2 border-indigo-300">
                  {{ userInitials() }}
                </div>
              }
              <div class="min-w-0 flex-1">
                <h4 class="m-0 text-sm font-bold text-white truncate">{{ profile()?.displayName || ('turnstileModal.valuedMember' | transloco) }}</h4>
                <p class="m-0 text-xs text-indigo-200 truncate">{{ profile()?.email || 'uye@odivongym.com' }}</p>
                <div class="mt-1 flex items-center gap-1.5">
                  <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span class="text-[10px] font-semibold uppercase text-emerald-300">
                    {{ membershipLabel() }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- QR Kod & Gövde Bölümü -->
          <div class="p-6 text-center">
            @if (scanSuccess()) {
              <!-- Geçiş Başarılı Animasyon Ekranı -->
              <div class="py-6 flex flex-col items-center justify-center animate-fade-in">
                <div class="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/20">
                  <mat-icon class="icon-size-10">check</mat-icon>
                </div>
                <h3 class="m-0 text-lg font-bold text-slate-900 dark:text-white">{{ 'turnstileModal.welcome' | transloco }}</h3>
                <p class="m-0 text-xs text-slate-600 dark:text-slate-300 max-w-xs mt-1">
                  {{ 'turnstileModal.successMsg' | transloco }}
                </p>
                <div class="mt-3 text-[11px] font-mono text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {{ 'turnstileModal.gateName' | transloco }} · {{ currentTimeString() }}
                </div>
              </div>
            } @else {
              <!-- QR Kod Çerçevesi -->
              <div class="p-3 bg-white rounded-2xl border-2 border-dashed border-indigo-200 shadow-sm relative group max-w-[220px] mx-auto">
                <!-- Gerçek Taranabilir Dinamik QR Kodu -->
                @if (qrDataUrl()) {
                  <img [src]="qrDataUrl()" class="w-48 h-48 rounded-xl object-contain mx-auto" [alt]="'turnstileModal.dynamicQrAlt' | transloco" />
                } @else {
                  <div class="w-48 h-48 flex items-center justify-center text-slate-400">
                    <mat-icon class="icon-size-8 animate-spin">refresh</mat-icon>
                  </div>
                }

                <!-- Güvenlik Işığı Efekti -->
                <div class="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent top-1/2 -translate-y-1/2 opacity-70 animate-pulse pointer-events-none"></div>
              </div>

              <!-- Ekran Görüntüsü Koruması & Sayaç -->
              <div class="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
                <mat-icon class="icon-size-3.5 text-indigo-600 animate-spin">refresh</mat-icon>
                <span>{{ 'turnstileModal.refreshCountdown' | transloco:{ seconds: secondsUntilRefresh() } }}</span>
              </div>
              <p class="m-0 mt-1 text-[11px] text-slate-400">
                {{ 'turnstileModal.scanDistance' | transloco }}
              </p>

              <!-- Turnike Simülasyon Butonu -->
              <button type="button"
                      class="odv-btn-primary w-full mt-5 !py-3 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                      [disabled]="scanning()"
                      (click)="simulateTurnstileScan()">
                @if (scanning()) {
                  <mat-icon class="icon-size-4.5 animate-spin">refresh</mat-icon>
                  <span>{{ 'turnstileModal.verifying' | transloco }}</span>
                } @else {
                  <mat-icon class="icon-size-4.5">sensors</mat-icon>
                  <span>{{ 'turnstileModal.simulateBtn' | transloco }}</span>
                }
              </button>
            }
          </div>

          <!-- Alt Bilgi / Güvenlik Şeridi -->
          <div class="bg-slate-50 dark:bg-slate-800/60 px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>ID: #{{ memberIdShort() }}</span>
            <span class="flex items-center gap-1">
              <mat-icon class="icon-size-3 text-emerald-600">verified</mat-icon>
              {{ 'turnstileModal.totpActive' | transloco }}
            </span>
          </div>
        </div>
      </div>
    }
  `,
})
export class MemberQrModal {
  protected readonly qrService = inject(MemberQrService);
  private readonly auth = inject(AuthService);
  private readonly accessService = inject(AdminAccessControlService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);

  protected readonly profile = this.auth.profile;

  protected readonly userInitials = computed(() => {
    const name = this.profile()?.displayName || '';
    if (!name.trim()) return 'Ü';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  });

  protected readonly memberIdShort = computed(() => {
    const uid = this.profile()?.uid || 'ODV9876';
    return uid.slice(-6).toUpperCase();
  });

  protected readonly membershipLabel = computed(() => {
    const status = this.profile()?.membershipStatus;
    if (status === 'active') return this.transloco.translate('turnstileModal.activeMembership');
    if (status === 'trial') return this.transloco.translate('turnstileModal.trialMembership');
    if (status === 'expired') return this.transloco.translate('turnstileModal.expiredMembership');
    return this.transloco.translate('turnstileModal.registeredAthlete');
  });

  protected readonly qrDataUrl = signal<string | null>(null);
  protected readonly currentRawPayload = signal<string>('');
  protected readonly scanning = signal(false);
  protected readonly scanSuccess = signal(false);
  protected readonly secondsUntilRefresh = signal(30);
  protected readonly currentTimeString = signal('');

  private countdownInterval: any = null;

  constructor() {
    this.startCountdown();

    // Modal açıldığında veya profil değiştiğinde QR kodunu yenile
    effect(() => {
      if (this.qrService.isOpen() && this.profile()) {
        void this.generateDynamicQr();
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }
    });
  }

  private startCountdown(): void {
    this.countdownInterval = setInterval(() => {
      const cur = this.secondsUntilRefresh();
      if (cur <= 1) {
        this.secondsUntilRefresh.set(30);
        if (this.qrService.isOpen()) {
          void this.generateDynamicQr();
        }
      } else {
        this.secondsUntilRefresh.set(cur - 1);
      }
    }, 1000);
  }

  protected async generateDynamicQr(): Promise<void> {
    const user = this.profile();
    if (!user || !user.uid) return;

    const payload = JSON.stringify({
      app: 'odivon_pass',
      ver: 1,
      uid: user.uid,
      tenantId: user.tenantId,
      name: user.displayName || 'Üye',
      exp: Date.now() + 30000,
      r: Math.random().toString(36).slice(2, 8),
    });

    this.currentRawPayload.set(payload);

    try {
      const url = await QRCode.toDataURL(payload, {
        width: 220,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      });
      this.qrDataUrl.set(url);
    } catch (err) {
      console.error('Odivon dynamic QR generate error:', err);
    }
  }

  protected onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.qrService.close();
    }
  }

  protected async simulateTurnstileScan(): Promise<void> {
    const user = this.profile();
    if (!user) {
      this.snackBar.open(this.transloco.translate('turnstileModal.userNotFound'), this.transloco.translate('common.close'), { duration: 2500 });
      return;
    }

    this.scanning.set(true);
    try {
      const now = new Date();
      this.currentTimeString.set(now.toLocaleTimeString(this.transloco.getActiveLang() === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      // Access control servisini tetikle
      const result = await this.accessService.processGateScan(user, 'in', 'Ana Turnike (A1)', 'qr');

      this.scanning.set(false);
      if (result.allowed) {
        this.scanSuccess.set(true);
        this.playSuccessTone();
        // 3 saniye sonra modalı kapat ve başarı durumunu sıfırla
        setTimeout(() => {
          this.scanSuccess.set(false);
          this.qrService.close();
        }, 3200);
      } else {
        this.snackBar.open(this.transloco.translate('turnstileModal.gateDenied', { msg: result.message }), this.transloco.translate('common.close'), { duration: 4000 });
      }
    } catch {
      this.scanning.set(false);
      this.snackBar.open(this.transloco.translate('turnstileModal.connError'), this.transloco.translate('common.close'), { duration: 3000 });
    }
  }

  private playSuccessTone(): void {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // safe fallback
    }
  }
}
