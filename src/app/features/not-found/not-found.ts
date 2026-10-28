import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { LogoMark } from '../../shared/components/logo-mark/logo-mark';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, LogoMark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen w-full flex flex-col justify-between bg-[#f8fafc] dark:bg-[#0b1120] text-slate-900 dark:text-white font-sans relative overflow-hidden select-none selection:bg-indigo-500 selection:text-white p-6 sm:p-10">
      
      <!-- Ambient Glow Orbs -->
      <div class="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div class="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:32px_32px] opacity-10 pointer-events-none"></div>

      <!-- Header: Logo & Brand -->
      <header class="relative z-10 flex items-center justify-between max-w-5xl mx-auto w-full">
        <div class="flex items-center gap-3">
          <app-logo-mark [size]="40" />
          <div class="flex flex-col">
            <span class="font-black text-xl tracking-tight text-slate-900 dark:text-white">OdivonGYM</span>
            <span class="text-[10px] font-semibold text-slate-400 -mt-0.5">Club & Athlete Cloud</span>
          </div>
        </div>

        <a
          [routerLink]="homeUrl()"
          class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 shadow-2xs transition-all no-underline cursor-pointer"
        >
          <mat-icon class="icon-size-4 text-indigo-500">home</mat-icon>
          <span class="hidden sm:inline">Platforma Dön</span>
        </a>
      </header>

      <!-- Center: 404 Hero Showcase -->
      <main class="relative z-10 max-w-xl mx-auto my-auto w-full text-center py-10">
        
        <!-- Athletic 404 Graphic Badge -->
        <div class="relative inline-flex items-center justify-center mb-6">
          <div class="absolute -inset-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 rounded-3xl blur-xl opacity-30 animate-pulse"></div>
          
          <div class="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col items-center justify-center p-4">
            <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2 shadow-xs">
              <mat-icon class="icon-size-7 text-indigo-500">fitness_center</mat-icon>
            </div>
            <span class="text-xs font-black tracking-widest uppercase text-indigo-600 dark:text-indigo-400">404 ERROR</span>
          </div>
        </div>

        <!-- Headline & Descriptions -->
        <h1 class="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
          Antrenman Rotası <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-400">Bulunamadı</span>
        </h1>
        
        <p class="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-normal leading-relaxed mb-8 max-w-md mx-auto">
          Aradığınız sayfa taşınmış, silinmiş veya geçici olarak kullanılamıyor olabilir. Salon alanına dönmek için aşağıdaki bağlantıları kullanabilirsiniz.
        </p>

        <!-- Action CTAs Bar -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
          <button
            type="button"
            (click)="goBack()"
            class="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <mat-icon class="icon-size-4 text-slate-400">arrow_back</mat-icon>
            <span>Önceki Sayfaya Dön</span>
          </button>

          <a
            [routerLink]="homeUrl()"
            class="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-600 hover:from-indigo-600 hover:to-purple-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer no-underline"
          >
            <mat-icon class="icon-size-4">dashboard</mat-icon>
            <span>{{ auth.isAuthenticated() ? 'Panele Git' : 'Giriş Ekranına Dön' }}</span>
          </a>
        </div>

        <!-- Quick Links Pill -->
        <div class="mt-10 pt-6 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <a routerLink="/terms" class="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors no-underline">Kullanım Şartları</a>
          <span>·</span>
          <a routerLink="/privacy" class="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors no-underline">Gizlilik & KVKK</a>
          <span>·</span>
          <a routerLink="/auth/login" class="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors no-underline">Giriş Yap</a>
          <span>·</span>
          <a routerLink="/auth/register" class="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors no-underline">Ücretsiz Kayıt</a>
        </div>
      </main>

      <!-- Footer -->
      <footer class="relative z-10 text-center text-xs text-slate-400 py-2">
        © {{ currentYear }} OdivonGYM · Tüm hakları saklıdır.
      </footer>
    </div>
  `,
})
export class NotFound {
  protected readonly auth = inject(AuthService);
  private readonly location = inject(Location);
  protected readonly currentYear = new Date().getFullYear();

  homeUrl(): string {
    return this.auth.isAuthenticated() ? '/dashboard' : '/auth/login';
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      window.location.href = this.homeUrl();
    }
  }
}
