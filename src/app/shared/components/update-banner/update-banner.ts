import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { VersionService } from '../../../core/version/version.service';

/** "New version" notice. Postponable banner, or a blocking dialog for critical releases. */
@Component({
  selector: 'app-update-banner',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (version.showBanner()) {
      @if (version.mandatory()) {
        <div class="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
          <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-center">
            <span class="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
              <mat-icon class="icon-size-6">system_update</mat-icon>
            </span>
            <h3 class="m-0 text-lg font-black text-slate-900 dark:text-white">Güncelleme gerekli</h3>
            <p class="m-0 text-sm text-slate-600 dark:text-slate-300">
              Yeni sürüm{{ version.available()?.version ? ' (' + version.available()?.version + ')' : '' }} yayınlandı ve bu sürümle devam edilemiyor.
              Güncelleme önbelleği temizler ve sizi yeniden giriş ekranına götürür.
            </p>
            @if (version.available()?.notes) {
              <p class="m-0 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-left">{{ version.available()?.notes }}</p>
            }
            <button type="button" class="odv-btn-primary w-full !py-3" [disabled]="version.applying()" (click)="version.applyUpdate()">
              {{ version.applying() ? 'Güncelleniyor…' : 'Şimdi güncelle' }}
            </button>
          </div>
        </div>
      } @else {
        <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000] w-[calc(100%-2rem)] max-w-xl" role="status">
          <div class="flex items-start gap-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 p-4">
            <mat-icon class="icon-size-5 text-indigo-300 shrink-0 mt-0.5">system_update</mat-icon>
            <div class="flex-1 min-w-0">
              <p class="m-0 text-sm font-bold">Yeni sürüm ({{ version.available()?.version }}) yayınlandı</p>
              <p class="m-0 text-xs text-slate-300 mt-0.5">
                {{ version.available()?.notes || 'İyileştirmeler ve hata düzeltmeleri.' }}
                Güncelleme önbelleği temizler; ardından yeniden giriş yapmanız gerekir.
              </p>
            </div>
            <div class="flex flex-col sm:flex-row gap-2 shrink-0">
              <button type="button" class="odv-btn-primary !py-1.5 !text-xs" [disabled]="version.applying()" (click)="version.applyUpdate()">
                {{ version.applying() ? 'Güncelleniyor…' : 'Güncelle' }}
              </button>
              <button type="button" class="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-transparent border border-slate-700 cursor-pointer" (click)="version.postpone()">
                Sonra
              </button>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class UpdateBanner {
  protected readonly version = inject(VersionService);
}
