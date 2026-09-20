import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth/auth.service';
import { AdminAccessControlService } from '../../../admin/access-control/admin-access-control.service';
import { MemberQrService } from './member-qr.service';

@Component({
  selector: 'app-member-qr-modal',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (qrService.isOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
           (click)="onBackdropClick($event)">
        
        <div class="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative"
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
                <span class="text-[10px] uppercase font-black tracking-widest text-indigo-300">DİJİTAL GEÇİŞ KARTI</span>
                <h3 class="m-0 text-base font-bold text-white leading-tight">OdivonGYM Akıllı Turnike</h3>
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
                <h4 class="m-0 text-sm font-bold text-white truncate">{{ profile()?.displayName || 'Değerli Üyemiz' }}</h4>
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

          <!-- Gövde: QR Kod & Güvenlik Dinamikleri -->
          <div class="p-6 flex flex-col items-center text-center">
            @if (scanSuccess()) {
              <!-- Başarılı Geçiş Animasyonu -->
              <div class="py-8 flex flex-col items-center gap-3 animate-fade-in">
                <div class="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner animate-bounce">
                  <mat-icon class="icon-size-10">check_circle</mat-icon>
                </div>
                <h3 class="m-0 text-lg font-black text-slate-900">Turnike Açıldı! 🟢</h3>
                <p class="m-0 text-xs text-slate-600 max-w-xs">
                  Geçiş onaylandı. Turnike kilidi çözüldü. İyi ve verimli bir antrenman dileriz!
                </p>
                <div class="mt-2 text-[11px] font-mono text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Ana Giriş Turnikesi · {{ currentTimeString() }}
                </div>
              </div>
            } @else {
              <!-- QR Kod Çerçevesi -->
              <div class="p-4 bg-white rounded-2xl border-2 border-dashed border-indigo-200 shadow-sm relative group">
                <!-- SVG QR Kodu (Responsive & Canlı Desen) -->
                <svg class="w-48 h-48 sm:w-52 sm:h-52" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <!-- Arka Plan -->
                  <rect width="100" height="100" rx="6" fill="#ffffff"/>
                  
                  <!-- Sol Üst Kare (Finder Pattern) -->
                  <rect x="8" y="8" width="26" height="26" rx="4" fill="#0f172a"/>
                  <rect x="12" y="12" width="18" height="18" rx="2" fill="#ffffff"/>
                  <rect x="16" y="16" width="10" height="10" rx="1.5" fill="#4f46e5"/>

                  <!-- Sağ Üst Kare (Finder Pattern) -->
                  <rect x="66" y="8" width="26" height="26" rx="4" fill="#0f172a"/>
                  <rect x="70" y="12" width="18" height="18" rx="2" fill="#ffffff"/>
                  <rect x="74" y="16" width="10" height="10" rx="1.5" fill="#4f46e5"/>

                  <!-- Sol Alt Kare (Finder Pattern) -->
                  <rect x="8" y="66" width="26" height="26" rx="4" fill="#0f172a"/>
                  <rect x="12" y="70" width="18" height="18" rx="2" fill="#ffffff"/>
                  <rect x="16" y="74" width="10" height="10" rx="1.5" fill="#4f46e5"/>

                  <!-- Dinamik Matris Noktaları -->
                  <!-- Sıra 1-2 -->
                  <rect x="40" y="10" width="6" height="6" rx="1" fill="#0f172a"/>
                  <rect x="52" y="10" width="6" height="6" rx="1" fill="#0f172a"/>
                  <rect x="46" y="18" width="6" height="6" rx="1" fill="#4f46e5"/>
                  <rect x="58" y="18" width="5" height="5" rx="1" fill="#0f172a"/>

                  <!-- Orta Bölüm -->
                  <rect x="10" y="40" width="6" height="6" rx="1" fill="#0f172a"/>
                  <rect x="20" y="44" width="6" height="6" rx="1" fill="#0f172a"/>
                  <rect x="30" y="38" width="6" height="6" rx="1" fill="#4f46e5"/>
                  <rect x="38" y="46" width="7" height="7" rx="1" fill="#0f172a"/>
                  <rect x="50" y="38" width="6" height="6" rx="1" fill="#0f172a"/>
                  <rect x="60" y="44" width="7" height="7" rx="1" fill="#4f46e5"/>
                  <rect x="74" y="40" width="6" height="6" rx="1" fill="#0f172a"/>
                  <rect x="84" y="44" width="7" height="7" rx="1" fill="#0f172a"/>

                  <!-- Alt Bölüm -->
                  <rect x="40" y="60" width="6" height="6" rx="1" fill="#0f172a"/>
                  <rect x="48" y="68" width="6" height="6" rx="1" fill="#4f46e5"/>
                  <rect x="58" y="62" width="6" height="6" rx="1" fill="#0f172a"/>
                  <rect x="66" y="70" width="6" height="6" rx="1" fill="#0f172a"/>
                  <rect x="76" y="62" width="6" height="6" rx="1" fill="#4f46e5"/>
                  <rect x="86" y="72" width="6" height="6" rx="1" fill="#0f172a"/>
                  <rect x="42" y="80" width="6" height="6" rx="1" fill="#0f172a"/>
                  <rect x="54" y="84" width="6" height="6" rx="1" fill="#0f172a"/>
                  <rect x="64" y="82" width="6" height="6" rx="1" fill="#4f46e5"/>
                  <rect x="78" y="84" width="6" height="6" rx="1" fill="#0f172a"/>

                  <!-- Merkez Amblem Rozeti -->
                  <rect x="43" y="43" width="14" height="14" rx="3" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
                  <circle cx="50" cy="50" r="4" fill="#4f46e5"/>
                </svg>
                
                <!-- Güvenlik Işığı Efekti -->
                <div class="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent top-1/2 -translate-y-1/2 opacity-70 animate-pulse pointer-events-none"></div>
              </div>

              <!-- Ekran Görüntüsü Koruması & Sayaç -->
              <div class="mt-3 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <mat-icon class="icon-size-3.5 text-indigo-600 animate-spin">refresh</mat-icon>
                <span>Dinamik Kod: <b>{{ secondsUntilRefresh() }}s</b> sonra yenilenir</span>
              </div>
              <p class="m-0 mt-1 text-[11px] text-slate-400">
                Turnike kamerasından 15-20 cm mesafede tutunuz.
              </p>

              <!-- Turnike Simülasyon Butonu -->
              <button type="button"
                      class="odv-btn-primary w-full mt-5 !py-3 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                      [disabled]="scanning()"
                      (click)="simulateTurnstileScan()">
                @if (scanning()) {
                  <mat-icon class="icon-size-4.5 animate-spin">refresh</mat-icon>
                  <span>Turnike Doğrulanıyor…</span>
                } @else {
                  <mat-icon class="icon-size-4.5">sensors</mat-icon>
                  <span>Turnikeye Okut (Simüle Et)</span>
                }
              </button>
            }
          </div>

          <!-- Alt Bilgi / Güvenlik Şeridi -->
          <div class="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>ID: #{{ memberIdShort() }}</span>
            <span class="flex items-center gap-1">
              <mat-icon class="icon-size-3 text-emerald-600">verified</mat-icon>
              256-Bit SSL Doğrulandı
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
    if (status === 'active') return 'Aktif Üyelik';
    if (status === 'trial') return '14 Günlük Deneme';
    if (status === 'expired') return 'Süresi Dolmuş';
    return 'Kayıtlı Sporcu';
  });

  protected readonly scanning = signal(false);
  protected readonly scanSuccess = signal(false);
  protected readonly secondsUntilRefresh = signal(30);
  protected readonly currentTimeString = signal('');

  private countdownInterval: any = null;

  constructor() {
    this.startCountdown();
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
      } else {
        this.secondsUntilRefresh.set(cur - 1);
      }
    }, 1000);
  }

  protected onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.qrService.close();
    }
  }

  protected async simulateTurnstileScan(): Promise<void> {
    const user = this.profile();
    if (!user) {
      this.snackBar.open('Kullanıcı profili bulunamadı.', 'Kapat', { duration: 2500 });
      return;
    }

    this.scanning.set(true);
    try {
      const now = new Date();
      this.currentTimeString.set(now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

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
        this.snackBar.open(`Turnike Reddedildi: ${result.message}`, 'Kapat', { duration: 4000 });
      }
    } catch {
      this.scanning.set(false);
      this.snackBar.open('Turnike bağlantı hatası, tekrar deneyin.', 'Kapat', { duration: 3000 });
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
