import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { CookieService } from '../../../core/services/cookie.service';
import { CookiePreferences } from '../../../core/models/cookie-consent.model';

@Component({
  selector: 'app-cookie-settings-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (cookieService.showSettingsModal()) {
      <div
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
        (click)="cookieService.closeSettings()"
      >
        <div
          class="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-labelledby="cookie-settings-title"
        >
          <!-- Header -->
          <div class="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/30">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                <mat-icon class="icon-size-5">cookie</mat-icon>
              </div>
              <div>
                <span class="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {{ 'cookieConsent.badge' | transloco }}
                </span>
                <h3 id="cookie-settings-title" class="text-base sm:text-lg font-black text-slate-900 dark:text-white m-0 leading-snug">
                  {{ 'cookieConsent.settingsTitle' | transloco }}
                </h3>
              </div>
            </div>

            <button
              type="button"
              class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
              (click)="cookieService.closeSettings()"
              [attr.aria-label]="'common.close' | transloco"
            >
              <mat-icon class="icon-size-4">close</mat-icon>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 space-y-4 overflow-y-auto flex-1">
            <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed m-0">
              {{ 'cookieConsent.settingsDesc' | transloco }}
            </p>

            <!-- 1. Zorunlu Çerezler (Essential) -->
            <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-xl bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                    <mat-icon class="icon-size-4">lock</mat-icon>
                  </div>
                  <div>
                    <h4 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white m-0">
                      {{ 'cookieConsent.essentialTitle' | transloco }}
                    </h4>
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {{ 'cookieConsent.alwaysActive' | transloco }}
                    </span>
                  </div>
                </div>

                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                  {{ 'cookieConsent.required' | transloco }}
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-2.5 mb-0 leading-relaxed">
                {{ 'cookieConsent.essentialDesc' | transloco }}
              </p>
            </div>

            <!-- 2. İşlevsel Çerezler (Functional - Beni Hatırla) -->
            <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/20 transition-all hover:border-slate-300 dark:hover:border-slate-700">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <mat-icon class="icon-size-4">bookmark_added</mat-icon>
                  </div>
                  <div>
                    <h4 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white m-0">
                      {{ 'cookieConsent.functionalTitle' | transloco }}
                    </h4>
                    <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      {{ 'cookieConsent.recommended' | transloco }}
                    </span>
                  </div>
                </div>

                <!-- Custom Toggle Switch -->
                <button
                  type="button"
                  (click)="toggleFunctional()"
                  class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  [ngClass]="functional() ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'"
                  role="switch"
                  [attr.aria-checked]="functional()"
                >
                  <span
                    class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out"
                    [ngClass]="functional() ? 'translate-x-5' : 'translate-x-0'"
                  ></span>
                </button>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-2.5 mb-0 leading-relaxed">
                {{ 'cookieConsent.functionalDesc' | transloco }}
              </p>
            </div>

            <!-- 3. Analitik Çerezler (Analytics) -->
            <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/20 transition-all hover:border-slate-300 dark:hover:border-slate-700">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <mat-icon class="icon-size-4">query_stats</mat-icon>
                  </div>
                  <div>
                    <h4 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white m-0">
                      {{ 'cookieConsent.analyticsTitle' | transloco }}
                    </h4>
                    <span class="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                      {{ 'cookieConsent.optional' | transloco }}
                    </span>
                  </div>
                </div>

                <!-- Custom Toggle Switch -->
                <button
                  type="button"
                  (click)="toggleAnalytics()"
                  class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  [ngClass]="analytics() ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'"
                  role="switch"
                  [attr.aria-checked]="analytics()"
                >
                  <span
                    class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out"
                    [ngClass]="analytics() ? 'translate-x-5' : 'translate-x-0'"
                  ></span>
                </button>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-2.5 mb-0 leading-relaxed">
                {{ 'cookieConsent.analyticsDesc' | transloco }}
              </p>
            </div>

            <!-- Aydınlatma Metni Linki -->
            <div class="pt-2 flex items-center justify-between text-xs">
              <button
                type="button"
                (click)="cookieService.openPolicyModal()"
                class="text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0"
              >
                <mat-icon class="icon-size-4">description</mat-icon>
                <span>{{ 'cookieConsent.readFullPolicy' | transloco }}</span>
              </button>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2.5 bg-slate-50/80 dark:bg-slate-900/80">
            <button
              type="button"
              (click)="cookieService.closeSettings()"
              class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {{ 'common.cancel' | transloco }}
            </button>
            <button
              type="button"
              (click)="saveCustom()"
              class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              {{ 'cookieConsent.savePreferences' | transloco }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CookieSettingsModal {
  protected readonly cookieService = inject(CookieService);

  readonly functional = signal<boolean>(
    this.cookieService.consent()?.preferences.functional ?? true,
  );
  readonly analytics = signal<boolean>(
    this.cookieService.consent()?.preferences.analytics ?? false,
  );

  toggleFunctional(): void {
    this.functional.update((v) => !v);
  }

  toggleAnalytics(): void {
    this.analytics.update((v) => !v);
  }

  saveCustom(): void {
    const prefs: CookiePreferences = {
      essential: true,
      functional: this.functional(),
      analytics: this.analytics(),
    };
    this.cookieService.saveCustomPreferences(prefs);
  }
}
