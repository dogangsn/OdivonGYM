import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { GuideService } from '../../../core/services/guide.service';

/**
 * Her sayfanın üstünde tutarlı bir başlık şeridi — ikon, başlık, açıklama ve
 * sağda aksiyon butonları için bir slot (`<ng-content select="[actions]">`).
 * Odivon Design System'in sayfa başlığı deseniyle stilize edilir.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="font-sans flex flex-wrap items-start justify-between gap-4 mb-6">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-3 flex-wrap">
          @if (icon()) {
            <span
              class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0"
            >
              <mat-icon class="icon-size-5">{{ icon() }}</mat-icon>
            </span>
          }
          <h1 class="m-0 text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {{ isKey(title()) ? (title() | transloco) : title() }}
          </h1>
          <button
            type="button"
            (click)="guide.open()"
            class="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 dark:from-indigo-950/60 dark:to-purple-950/60 dark:hover:from-indigo-900/60 dark:hover:to-purple-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 text-xs font-bold transition-all shadow-2xs hover:scale-105 active:scale-95 cursor-pointer"
            title="Bu ekranın kullanım kılavuzunu ve özelliklerini incele"
          >
            <mat-icon class="icon-size-3.5 text-indigo-600 dark:text-indigo-400">menu_book</mat-icon>
            <span>Kılavuz</span>
            <span class="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[8px] font-black uppercase tracking-wider">EĞİTİM</span>
          </button>
        </div>
        @if (description()) {
          <p class="mt-1.5 mb-0 max-w-[60ch] text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            {{ isKey(description()) ? (description() | transloco) : description() }}
          </p>
        }
      </div>
      <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 justify-start sm:justify-end">
        <ng-content select="[actions]" />
      </div>
    </header>
  `,
})
export class PageHeader {
  protected readonly guide = inject(GuideService);

  readonly title = input.required<string>();
  readonly description = input<string>('');
  readonly icon = input<string>('');

  protected isKey(val: string): boolean {
    return Boolean(val && val.includes('.') && !val.includes(' ') && !val.includes('\n'));
  }
}
