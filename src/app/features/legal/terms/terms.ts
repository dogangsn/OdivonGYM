import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { LogoMark } from '../../../shared/components/logo-mark/logo-mark';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-terms',
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
              <span class="text-[10px] font-semibold text-slate-400 block -mt-1">Kullanım Şartları & Lisans</span>
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
            <mat-icon class="icon-size-4">gavel</mat-icon>
            <span>Hukuki Belge & Sözleşme</span>
          </div>
          <h1 class="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
            Kullanım Şartları ve Hizmet Sözleşmesi
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 m-0">
            Son Güncelleme: 24 Ekim 2026 · Versiyon 2.1 · OdivonGYM SaaS Platformu
          </p>
        </div>

        <!-- Document Body -->
        <article class="p-6 sm:p-10 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-8 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300 select-text">
          
          <section class="space-y-3">
            <h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 inline-flex items-center justify-center text-xs font-black">1</span>
              Genel Hükümler ve Taraflar
            </h2>
            <p>
              İşbu Kullanım Şartları Sözleşmesi ("Sözleşme"), OdivonGYM bulut tabanlı spor salonu yönetim platformunu ("Hizmet", "Platform") işleten Odivon Yazılım Teknolojileri ("Odivon", "Şirket") ile Platforma üye olan, salon açan, turnike/kiosk sistemlerini bağlayan veya üye olarak faydalanan tüzel ve gerçek kişiler ("Kullanıcı", "İşletmeci", "Üye") arasında akdedilmiştir.
            </p>
            <p>
              Platforma kaydolarak veya Platformu kullanarak bu Sözleşmede yer alan tüm şartları kabul etmiş sayılırsınız. Şartları kabul etmiyorsanız lütfen Platformu kullanmayınız.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 inline-flex items-center justify-center text-xs font-black">2</span>
              Hizmetin Niteliği ve Lisans Kapsamı
            </h2>
            <p>
              OdivonGYM; spor salonları, stüdyolar, antrenörler ve sporcular için tasarlanmış çok kiracılı (multi-tenant) bir Hizmet Olarak Yazılım (SaaS) çözümüdür. Kullanıcıya verilen lisans; devredilemez, münhasır olmayan ve abonelik süresince geçerli sınırlı bir kullanım hakkından ibarettir.
            </p>
            <ul class="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
              <li>Turnike, kapı rölesi ve Edge Agent modüllerinin kullanımı salon içi donanım güvenliğiyle sınırlıdır.</li>
              <li>Platformun tersine mühendisliğe tabi tutulması, kaynak kodunun kopyalanması veya lisanssız çoğaltılması kesinlikle yasaktır.</li>
            </ul>
          </section>

          <section class="space-y-3">
            <h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 inline-flex items-center justify-center text-xs font-black">3</span>
              Ücretsiz Deneme, Abonelik ve Ödeme Koşulları
            </h2>
            <p>
              Yeni salon kayıtlarında 14 günlük ücretsiz tam sürüm deneme imkanı tanınır. Deneme süresince kredi kartı bilgisi zorunlu tutulmaz. Deneme süresi bitiminde platformu kullanmaya devam edebilmek için yürürlükteki SaaS abonelik paketlerinden biri seçilmelidir.
            </p>
            <p>
              Tüm çevrimiçi ödemeler iyzico güvencesiyle 3D Secure protokolü üzerinden gerçekleştirilir. Hizmet bedellerine ilişkin e-Fatura / e-Arşiv faturaları sistemde kayıtlı e-posta adresinize iletilir.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 inline-flex items-center justify-center text-xs font-black">4</span>
              Hesap Güvenliği ve Kullanıcı Yükümlülükleri
            </h2>
            <p>
              Kullanıcı, hesabına erişim için kullandığı şifre ve kimlik doğrulama bilgilerinin gizliliğinden bizzat sorumludur. Hesabınız altında gerçekleşen tüm faaliyetlerden tarafınız sorumludur. Yetkisiz bir erişim veya güvenlik ihlali fark edilmesi durumunda derhal Odivon desteği ile iletişime geçilmelidir.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 inline-flex items-center justify-center text-xs font-black">5</span>
              Hizmet Seviyesi (SLA) ve Veri Yedekliliği
            </h2>
            <p>
              OdivonGYM, platformun kesintisiz ve yüksek performansla çalışması için sektör standardı bulut altyapıları (Google Cloud Firestore, CDN ve TLS şifreleme) kullanmaktadır. Planlı bakım çalışmaları haricinde %99.5 erişilebilirlik hedeflenmektedir. Odivon, mücbir sebepler veya kontrolü dışındaki altyapı kesintilerinden sorumlu tutulamaz.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 inline-flex items-center justify-center text-xs font-black">6</span>
              Uyuşmazlıkların Çözümü
            </h2>
            <p>
              İşbu Sözleşmenin uygulanmasından veya yorumlanmasından doğacak her türlü uyuşmazlığın çözümünde Türk Hukuku uygulanacak olup, İstanbul (Çağlayan) Mahkemeleri ve İcra Daireleri yetkilidir.
            </p>
          </section>

        </article>

        <!-- Bottom CTAs -->
        <div class="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl bg-indigo-50/70 dark:bg-slate-900 border border-indigo-200/60 dark:border-slate-800">
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white m-0">Gizlilik Politikamızı İncelediniz mi?</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5">Kişisel verilerinizin nasıl korunduğunu öğrenin.</p>
          </div>
          <div class="flex items-center gap-2">
            <a
              routerLink="/privacy"
              class="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-xs font-bold text-slate-700 dark:text-slate-200 no-underline shadow-2xs transition-all"
            >
              Gizlilik Politikası
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
export class Terms {
  protected readonly auth = inject(AuthService);
  protected readonly currentYear = new Date().getFullYear();

  homeUrl(): string {
    return this.auth.isAuthenticated() ? '/dashboard' : '/auth/login';
  }

  printPage(): void {
    window.print();
  }
}
