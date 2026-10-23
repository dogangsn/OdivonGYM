import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { LogoMark } from '../../../shared/components/logo-mark/logo-mark';
import { AuthService } from '../../../core/auth/auth.service';
import { CookieService } from '../../../core/services/cookie.service';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, LogoMark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen w-full flex flex-col justify-between bg-[#f8fafc] dark:bg-[#0b1120] text-slate-900 dark:text-white font-sans relative overflow-hidden select-none selection:bg-indigo-500 selection:text-white">
      
      <!-- Ambient Glow Orbs -->
      <div class="absolute -top-40 -left-40 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none"></div>
      <div class="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[140px] pointer-events-none"></div>
      
      <!-- Top Navigation Bar -->
      <header class="relative z-10 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <app-logo-mark [size]="38" />
            <div>
              <span class="font-black text-xl tracking-tight text-slate-900 dark:text-white">OdivonGYM</span>
              <span class="text-[10px] font-semibold text-slate-400 block -mt-1">Gizlilik & KVKK Politikası</span>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button
              type="button"
              (click)="printPage()"
              class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              <mat-icon class="icon-size-4 text-slate-400">print</mat-icon>
              <span>Yazdır</span>
            </button>

            <a
              [routerLink]="homeUrl()"
              class="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-black shadow-md shadow-indigo-500/25 transition-all no-underline cursor-pointer"
            >
              {{ auth.isAuthenticated() ? 'Panele Git' : 'Giriş Ekranı' }}
            </a>
          </div>
        </div>
      </header>

      <!-- Main Legal Content Container -->
      <main class="relative z-10 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex-1">
        
        <!-- Header Card -->
        <div class="mb-8 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xl relative overflow-hidden">
          <div class="flex items-center gap-2 mb-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
            <mat-icon class="icon-size-4">verified_user</mat-icon>
            <span>6698 Sayılı KVKK & GDPR Uyumlu</span>
          </div>
          <h1 class="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
            Gizlilik Politikası ve Kişisel Verilerin Korunması
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 m-0">
            Son Güncelleme: 24 Ekim 2026 · Versiyon 2.1 · OdivonGYM Güvenlik Standartları
          </p>
        </div>

        <!-- Document Body -->
        <article class="p-6 sm:p-10 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-8 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300 select-text">
          
          <section class="space-y-3">
            <h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 inline-flex items-center justify-center text-xs font-black">1</span>
              Veri Sorumlusunun Kimliği
            </h2>
            <p>
              6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") ve Avrupa Birliği Genel Veri Koruma Tüzüğü ("GDPR") uyarınca, veri sorumlusu sıfatıyla Odivon Yazılım Teknolojileri ("Odivon") olarak kişisel verilerinizin güvenliğine ve gizliliğine azami hassasiyet göstermekteyiz.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 inline-flex items-center justify-center text-xs font-black">2</span>
              İşlenen Kişisel Veriler ve Toplama Yöntemleri
            </h2>
            <p>Platformumuz aracılığıyla aşağıdaki veri kategorileri toplanmakta ve işlenmektedir:</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <span class="font-bold text-indigo-600 dark:text-indigo-400 block mb-1">Kimlik & İletişim Bilgileri</span>
                Ad, soyad, T.C. kimlik numarası (e-fatura için), telefon numarası, e-posta adresi.
              </div>
              <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <span class="font-bold text-emerald-600 dark:text-emerald-400 block mb-1">Geçiş & Telemetri Kayıtları</span>
                Turnike QR geçiş logları, salona giriş-çıkış zaman damgaları, üyelik seans kontrolleri.
              </div>
              <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <span class="font-bold text-rose-600 dark:text-rose-400 block mb-1">Finansal ve Fatura Bilgileri</span>
                Ödeme durumları, iyzico işlem referansları, e-arşiv fatura kayıtları (Kart numaraları sunucularımızda saklanmaz).
              </div>
              <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <span class="font-bold text-purple-600 dark:text-purple-400 block mb-1">Spor ve Sağlık Verileri (İsteğe Bağlı)</span>
                Boy, kilo, vücut kitle endeksi (BMI), antrenör tarafından atanan antrenman ve gelişim ölçümleri.
              </div>
            </div>
          </section>

          <section class="space-y-3">
            <h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 inline-flex items-center justify-center text-xs font-black">3</span>
              Kişisel Verilerin İşlenme Amaçları
            </h2>
            <p>Kişisel verileriniz aşağıdaki amaçlarla sınırlı olarak işlenmektedir:</p>
            <ul class="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
              <li>Spor salonu üyelik sözleşmesinin kurulması, ifası ve devamlılığının sağlanması,</li>
              <li>QR ve turnike kontrolü ile salon güvenliğinin temin edilmesi,</li>
              <li>Abonelik, paket ve üye cüzdanı finansal işlemlerinin muhasebeleştirilmesi,</li>
              <li>Yasal yükümlülüklerin yerine getirilmesi (Vergi Usul Kanunu, e-Fatura entegrasyonu),</li>
              <li>Sistem performansının, hata kayıtlarının ve müşteri destek taleplerinin takibi.</li>
            </ul>
          </section>

          <section class="space-y-3">
            <h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 inline-flex items-center justify-center text-xs font-black">4</span>
              Çerezler (Cookies) ve Yerel Depolama
            </h2>
            <p>
              OdivonGYM, güvenli oturum açma, dil tercihlerinin hatırlanması ve anonim performans analitiği için çerezler ve tarayıcı yerel depolama (LocalStorage) teknolojilerini kullanır. Çerez tercihlerinizi dilediğiniz zaman aşağıdaki butona tıklayarak güncelleyebilirsiniz:
            </p>
            <div class="pt-2">
              <button
                type="button"
                (click)="openCookieSettings()"
                class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 font-bold text-xs hover:bg-indigo-100 cursor-pointer transition-all shadow-xs"
              >
                <mat-icon class="icon-size-4">tune</mat-icon>
                <span>Çerez Tercihlerini Yönet</span>
              </button>
            </div>
          </section>

          <section class="space-y-3">
            <h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 inline-flex items-center justify-center text-xs font-black">5</span>
              İlgili Kişinin (Veri Sahibinin) Hakları
            </h2>
            <p>
              KVKK'nın 11. maddesi uyarınca veri sahipleri; kişisel verilerinin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işlenme amacına uygun kullanılıp kullanılmadığını öğrenme, eksik veya yanlış işlenmişse düzeltilmesini isteme ve silinmesini veya yok edilmesini talep etme hakkına sahiptir.
            </p>
            <p>
              Haklarınıza ilişkin taleplerinizi <strong class="text-indigo-600 dark:text-indigo-400">kvkk@odivon.com</strong> adresine iletebilirsiniz.
            </p>
          </section>

        </article>

        <!-- Bottom CTAs -->
        <div class="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl bg-indigo-50/70 dark:bg-slate-900 border border-indigo-200/60 dark:border-slate-800">
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white m-0">Kullanım Şartlarımızı İncelediniz mi?</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5">SaaS lisansı ve üyelik koşulları hakkında bilgi edinin.</p>
          </div>
          <div class="flex items-center gap-2">
            <a
              routerLink="/terms"
              class="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-xs font-bold text-slate-700 dark:text-slate-200 no-underline shadow-2xs transition-all"
            >
              Kullanım Şartları
            </a>
            <a
              routerLink="/auth/register"
              class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black no-underline shadow-md shadow-indigo-600/25 transition-all"
            >
              14 Gün Ücretsiz Başla
            </a>
          </div>
        </div>

      </main>

      <!-- Footer -->
      <footer class="relative z-10 w-full border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-400">
        © {{ currentYear }} OdivonGYM · Tüm hakları saklıdır.
      </footer>
    </div>
  `,
})
export class Privacy {
  protected readonly auth = inject(AuthService);
  protected readonly cookieService = inject(CookieService);
  protected readonly currentYear = new Date().getFullYear();

  homeUrl(): string {
    return this.auth.isAuthenticated() ? '/dashboard' : '/auth/login';
  }

  openCookieSettings(): void {
    this.cookieService.openSettings();
  }

  printPage(): void {
    window.print();
  }
}
