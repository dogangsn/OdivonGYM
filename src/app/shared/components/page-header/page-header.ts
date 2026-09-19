import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Her sayfanın üstünde tutarlı bir başlık şeridi — ikon, başlık, açıklama ve
 * sağda aksiyon butonları için bir slot (`<ng-content select="[actions]">`).
 * Odivon Design System'in sayfa başlığı deseniyle stilize edilir.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="font-sans flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-3">
          @if (icon()) {
            <span
              class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0"
            >
              <mat-icon class="icon-size-5">{{ icon() }}</mat-icon>
            </span>
          }
          <h1 class="m-0 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {{ title() }}
          </h1>
        </div>
        @if (description()) {
          <p class="mt-1.5 mb-0 max-w-[60ch] text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            {{ description() }}
          </p>
        }
      </div>
      <div class="flex items-center gap-2">
        <ng-content select="[actions]" />
      </div>
    </header>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly description = input<string>('');
  readonly icon = input<string>('');
}
