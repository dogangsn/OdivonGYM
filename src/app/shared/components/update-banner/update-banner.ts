import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { VersionService } from '../../../core/version/version.service';

/**
 * Blocking "new version" dialog: shown for every new release, cannot be closed or postponed.
 * The only action signs out, clears caches/storage and reloads to the login page.
 */
@Component({
  selector: 'app-update-banner',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (version.updateRequired()) {
      <div class="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
           role="alertdialog" aria-modal="true" aria-labelledby="update-title">
        <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-center">
          <span class="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
            <mat-icon class="icon-size-6">system_update</mat-icon>
          </span>
          <h3 id="update-title" class="m-0 text-lg font-black text-slate-900 dark:text-white">
            Yeni sürüm{{ version.available()?.version ? ' (' + version.available()?.version + ')' : '' }} yayınlandı
          </h3>
          <p class="m-0 text-sm text-slate-600 dark:text-slate-300">
            Devam etmek için güncelleme gerekiyor. Güncelleme önbelleği temizler, oturumunuzu kapatır ve
            sizi yeniden giriş ekranına götürür.
          </p>
          @if (version.available()?.notes) {
            <p class="m-0 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-left">{{ version.available()?.notes }}</p>
          }
          <button type="button" class="odv-btn-primary w-full !py-3" [disabled]="version.applying()" (click)="version.applyUpdate()">
            {{ version.applying() ? 'Güncelleniyor…' : 'Güncelle' }}
          </button>
        </div>
      </div>
    }
  `,
})
export class UpdateBanner {
  protected readonly version = inject(VersionService);
}
