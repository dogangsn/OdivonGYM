import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { CookieService } from '../../../core/services/cookie.service';
import { CookieSettingsModal } from './cookie-settings-modal';
import { ConsentModal } from '../consent-modal/consent-modal';

@Component({
  selector: 'app-cookie-consent-banner',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslocoPipe, CookieSettingsModal, ConsentModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (cookieService.showBanner()) {
      <aside
        class="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-xl z-[9990] animate-in slide-in-from-bottom-6 duration-300 select-none"
        role="region"
        aria-label="Çerez İzin Bildirimi"
      >
        <!-- Glassmorphic Card Container -->
        <div class="relative overflow-hidden rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.25)] p-5 sm:p-6 transition-all">
          <!-- Subtle Glow Highlights -->
          <div class="absolute -top-10 -right-10 w-28 h-28 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none"></div>
          <div class="absolute -bottom-10 -left-10 w-28 h-28 bg-purple-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <!-- Header -->
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 shrink-0">
                <mat-icon class="icon-size-5 text-white">cookie</mat-icon>
              </div>
              <div>
                <span class="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {{ 'cookieConsent.badge' | transloco }}
                </span>
                <h3 class="text-sm sm:text-base font-black text-slate-900 dark:text-white m-0 leading-tight">
                  {{ 'cookieConsent.bannerTitle' | transloco }}
                </h3>
              </div>
            </div>

            <button
              type="button"
              (click)="cookieService.acceptEssentialOnly()"
              class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
              [attr.aria-label]="'common.close' | transloco"
              [title]="'cookieConsent.essentialOnly' | transloco"
            >
              <mat-icon class="icon-size-4">close</mat-icon>
            </button>
          </div>

          <!-- Description Text -->
          <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
            {{ 'cookieConsent.bannerDesc' | transloco }}
            <button
              type="button"
              (click)="cookieService.openPolicyModal()"
              class="text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline ml-1 cursor-pointer bg-transparent border-none p-0"
            >
              {{ 'cookieConsent.readPolicyInline' | transloco }}
            </button>
          </p>

          <!-- Action Buttons Bar -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            <button
              type="button"
              (click)="cookieService.openSettings()"
              class="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center justify-center gap-1.5 py-2 px-1 cursor-pointer bg-transparent border-none transition-colors"
            >
              <mat-icon class="icon-size-4 text-slate-400">tune</mat-icon>
              <span>{{ 'cookieConsent.customize' | transloco }}</span>
            </button>

            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="cookieService.acceptEssentialOnly()"
                class="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                {{ 'cookieConsent.essentialOnly' | transloco }}
              </button>

              <button
                type="button"
                (click)="cookieService.acceptAll()"
                class="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-black shadow-md shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                {{ 'cookieConsent.acceptAll' | transloco }}
              </button>
            </div>
          </div>
        </div>
      </aside>
    }

    <!-- Modal for Detailed Settings -->
    <app-cookie-settings-modal />

    <!-- Legal Text Modal (KVKK & Çerez Metni) -->
    <app-consent-modal />
  `,
})
export class CookieConsentBanner {
  protected readonly cookieService = inject(CookieService);
}
