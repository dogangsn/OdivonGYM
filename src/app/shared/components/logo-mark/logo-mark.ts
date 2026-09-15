import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextId = 0;

/**
 * Marka amblemi — bkz. `public/favicon.svg`. Aynı geometriyi (rotate(35deg)
 * ellipse) burada gradyan + "glow" ile büyük boy kullanım için (login,
 * register, header, dashboard) tekrar üretir. Tek yerden yönetildiği için
 * marka rengi değişirse sadece burası güncellenir.
 */
@Component({
  selector: 'app-logo-mark',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="logo-mark" [style.--logo-size.px]="size()">
      <span class="logo-mark__glow" aria-hidden="true"></span>
      <svg viewBox="0 0 64 64" class="logo-mark__ring" aria-hidden="true">
        <defs>
          <linearGradient [attr.id]="gradientId" x1="10%" y1="0%" x2="90%" y2="100%">
            <stop offset="0%" stop-color="#93c5fd" />
            <stop offset="55%" stop-color="#917aff" />
            <stop offset="100%" stop-color="#5b21b6" />
          </linearGradient>
        </defs>
        <ellipse
          cx="32"
          cy="32"
          rx="15"
          ry="19"
          transform="rotate(35 32 32)"
          fill="none"
          [attr.stroke]="'url(#' + gradientId + ')'"
          stroke-width="9"
          stroke-linecap="round"
        />
      </svg>
    </span>
  `,
  styles: `
    .logo-mark {
      --logo-size: 56;
      position: relative;
      display: inline-flex;
      width: calc(var(--logo-size) * 1px);
      height: calc(var(--logo-size) * 1px);
      flex-shrink: 0;
    }

    .logo-mark__glow {
      position: absolute;
      inset: -20%;
      border-radius: 50%;
      background: radial-gradient(circle, var(--brand-glow), transparent 70%);
      filter: blur(calc(var(--logo-size) * 0.18px));
      opacity: 0.9;
    }

    .logo-mark__ring {
      position: relative;
      width: 100%;
      height: 100%;
      filter: drop-shadow(0 6px 14px color-mix(in srgb, var(--brand-500) 45%, transparent));
    }
  `,
})
export class LogoMark {
  readonly size = input(56);
  protected readonly gradientId = `logo-mark-gradient-${nextId++}`;
}
