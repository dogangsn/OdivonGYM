import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Tam ekran yükleme sahnesi: akan aurora arka plan, kendini çizen Odivon amblemi,
 * etrafında dönen ışık parçacıkları ve yayılan halkalar, ışıltılı ODIVON yazısı.
 * Uygulama açılışı, giriş ve veri yüklemelerinde kullanılır (bkz. app.html).
 * Renkler marka/tema değişkenlerinden gelir; hareket azaltma tercihine saygı duyar.
 */
@Component({
  selector: 'app-loading-stage',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    'aria-live': 'polite',
    'aria-busy': 'true',
  },
  template: `
    <div class="stage__aurora" aria-hidden="true">
      <span class="blob blob--a"></span>
      <span class="blob blob--b"></span>
      <span class="blob blob--c"></span>
    </div>
    <div class="stage__grid" aria-hidden="true"></div>

    <div class="stage__center">
      <div class="emblem" aria-hidden="true">
        <span class="emblem__ripple"></span>
        <span class="emblem__ripple emblem__ripple--2"></span>
        <span class="emblem__ripple emblem__ripple--3"></span>
        <span class="emblem__glow"></span>
        <span class="emblem__orbit emblem__orbit--1"><i></i></span>
        <span class="emblem__orbit emblem__orbit--2"><i></i></span>
        <span class="emblem__orbit emblem__orbit--3"><i></i></span>

        <svg viewBox="0 0 64 64" class="emblem__mark">
          <defs>
            <linearGradient id="loading-stage-grad" x1="10%" y1="0%" x2="90%" y2="100%">
              <stop offset="0%" class="stop-a" />
              <stop offset="55%" class="stop-b" />
              <stop offset="100%" class="stop-c" />
            </linearGradient>
          </defs>
          <g transform="rotate(35 32 32)">
            <ellipse cx="32" cy="32" rx="15" ry="19" class="mark__track" />
            <ellipse cx="32" cy="32" rx="15" ry="19" pathLength="100" class="mark__draw" />
          </g>
        </svg>
      </div>

      <div class="wordmark" aria-hidden="true">
        <span class="wordmark__name">
          @for (ch of letters; track $index) {
            <span class="wordmark__ch" [style.animation-delay.ms]="$index * 70">{{ ch }}</span>
          }
        </span>
        <span class="wordmark__tag">GYM</span>
      </div>

      <div class="stage__message">
        @for (m of [message()]; track m) {
          <p class="stage__text">{{ m }}</p>
        }
        @if (submessage()) {
          <p class="stage__sub">{{ submessage() }}</p>
        }
      </div>

      <div class="stage__bar" aria-hidden="true"><span></span></div>
    </div>
  `,
  styleUrl: './loading-stage.scss',
})
export class LoadingStage {
  readonly message = input<string>('Veriler yükleniyor…');
  readonly submessage = input<string>('');

  protected readonly letters = 'ODIVON'.split('');
}
