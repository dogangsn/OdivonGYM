import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Sırayla gösterilen spor ikonları (Material Icons). */
const ICONS = ['fitness_center', 'monitor_heart', 'directions_run', 'timer', 'sports_gymnastics', 'self_improvement'];

/**
 * Sayfalar arası veri yüklemelerinde gösterilen küçük modal yükleyici.
 * Dönen marka renkli ışık halkasının içinde spor ikonları sırayla belirip kaybolur.
 * Panel arkada görünür kalır. Tam ekran sahne yalnızca girişte kullanılır (LoadingStage).
 */
@Component({
  selector: 'app-gym-busy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    'aria-live': 'polite',
    'aria-busy': 'true',
  },
  template: `
    <div class="busy">
      <div class="busy__badge" aria-hidden="true">
        <span class="busy__ring"></span>
        <span class="busy__core">
          @for (icon of icons; track icon) {
            <span
              class="busy__icon material-icons"
              [style.animation-delay]="'calc(var(--step) * ' + $index + ')'"
            >{{ icon }}</span>
          }
        </span>
      </div>
      <div class="busy__text">
        @for (m of [message()]; track m) {
          <p class="busy__message">{{ m }}</p>
        }
        <span class="busy__dots" aria-hidden="true">
          @for (icon of icons; track icon) {
            <i [style.animation-delay]="'calc(var(--step) * ' + $index + ')'"></i>
          }
        </span>
      </div>
    </div>
  `,
  styleUrl: './gym-busy.scss',
})
export class GymBusy {
  readonly message = input<string>('Veriler yükleniyor…');
  protected readonly icons = ICONS;
}
