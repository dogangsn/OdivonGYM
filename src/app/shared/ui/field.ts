import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Etiket + girdi + hata/ipucu satırı. Girdi `ng-content` ile verilir (`class="odv-input"`). */
@Component({
  selector: 'app-field',
  standalone: true,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
        {{ label() }}
        @if (required()) {
          <span class="text-rose-500">*</span>
        }
      </label>
      <ng-content />
      @if (error()) {
        <p class="text-xs text-rose-500 mt-1 mb-0">{{ error() }}</p>
      } @else if (hint()) {
        <p class="text-[11px] text-slate-400 mt-1 mb-0">{{ hint() }}</p>
      }
    </div>
  `,
})
export class Field {
  readonly label = input.required<string>();
  readonly required = input(false);
  readonly error = input('');
  readonly hint = input('');
}
