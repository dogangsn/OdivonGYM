import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { LogoMark } from '../logo-mark/logo-mark';

interface Pill {
  icon: string;
  labelKey: string;
}

interface Stat {
  value: string;
  labelKey: string;
}

const PILLS: Pill[] = [
  { icon: 'qr_code_2', labelKey: 'auth.brandPanel.pill1' },
  { icon: 'sports_gymnastics', labelKey: 'auth.brandPanel.pill2' },
  { icon: 'card_membership', labelKey: 'auth.brandPanel.pill3' },
];

const STATS: Stat[] = [
  { value: '500+', labelKey: 'auth.brandPanel.stat1Label' },
  { value: '30+', labelKey: 'auth.brandPanel.stat2Label' },
  { value: '%98', labelKey: 'auth.brandPanel.stat3Label' },
];

/**
 * Login/Register sayfalarının marka paneli — masaüstünde formla yan yana,
 * dar ekranlarda tamamen gizlenir (bkz. login.scss / register.scss).
 * Metinler `variant`'a göre `auth.brandPanel.{login|register}*` çeviri
 * anahtarlarından gelir — böylece dil değişince (bkz. LanguageService)
 * içerik de otomatik güncellenir.
 */
@Component({
  selector: 'app-auth-brand-panel',
  standalone: true,
  imports: [MatIconModule, LogoMark, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="brand-panel">
      <div class="brand-panel__glow" aria-hidden="true"></div>
      <div class="brand-panel__icons" aria-hidden="true"></div>

      <div class="brand-panel__content">
        <div class="brand-panel__logo-tile">
          <app-logo-mark [size]="56" />
        </div>

        <h1>
          {{ 'auth.brandPanel.' + variant() + 'HeadlinePrefix' | transloco
          }}<span class="highlight">{{ 'auth.brandPanel.' + variant() + 'HeadlineHighlight' | transloco }}</span
          >{{ 'auth.brandPanel.' + variant() + 'HeadlineSuffix' | transloco }}
        </h1>
        <p class="subheadline">{{ 'auth.brandPanel.' + variant() + 'Subheadline' | transloco }}</p>

        <div class="brand-panel__pills">
          @for (pill of pills; track pill.labelKey) {
            <span class="pill">
              <mat-icon>{{ pill.icon }}</mat-icon>
              {{ pill.labelKey | transloco }}
            </span>
          }
        </div>

        <div class="brand-panel__stats">
          @for (stat of stats; track stat.labelKey) {
            <div class="stat">
              <p class="stat__value">{{ stat.value }}</p>
              <p class="stat__label">{{ stat.labelKey | transloco }}</p>
            </div>
          }
        </div>

        <div class="brand-panel__divider"></div>

        <p class="brand-panel__testimonial">
          <mat-icon>check_circle</mat-icon>
          {{ 'auth.brandPanel.testimonial' | transloco }}
        </p>
      </div>

      <p class="brand-panel__footer">{{ 'auth.brandPanel.footer' | transloco: { year } }}</p>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .brand-panel {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 56px;
      overflow: hidden;
      background: #0b0b14;
      color: white;
    }

    .brand-panel__glow {
      position: absolute;
      inset: -20%;
      background:
        radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--brand-500) 38%, transparent), transparent 55%),
        radial-gradient(circle at 85% 85%, color-mix(in srgb, #f472b6 20%, transparent), transparent 50%),
        radial-gradient(circle at 10% 90%, color-mix(in srgb, #60a5fa 18%, transparent), transparent 50%);
    }

    // Soluk, tekrarlayan halter/dambıl deseni — "bu bir SaaS paneli" değil,
    // ilk bakışta "bu bir spor salonu uygulaması" dedirtsin diye.
    .brand-panel__icons {
      position: absolute;
      inset: -10%;
      opacity: 0.07;
      transform: rotate(-10deg);
      background-repeat: repeat;
      background-size: 84px 84px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='84' height='84' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='1.4'%3E%3Crect x='1' y='9' width='3' height='6' rx='1'/%3E%3Crect x='4' y='7' width='2' height='10' rx='1'/%3E%3Crect x='6' y='10.5' width='12' height='3' rx='1'/%3E%3Crect x='18' y='7' width='2' height='10' rx='1'/%3E%3Crect x='20' y='9' width='3' height='6' rx='1'/%3E%3C/svg%3E");
      -webkit-mask-image: radial-gradient(circle at 50% 35%, black, transparent 72%);
      mask-image: radial-gradient(circle at 50% 35%, black, transparent 72%);
    }

    .brand-panel__content {
      position: relative;
      max-width: 460px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .brand-panel__logo-tile {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 96px;
      height: 96px;
      margin-bottom: 28px;
      border-radius: 24px;
      background: linear-gradient(160deg, rgb(255 255 255 / 0.06), rgb(255 255 255 / 0.02));
      border: 1px solid rgb(255 255 255 / 0.1);
      box-shadow: 0 24px 48px -16px color-mix(in srgb, var(--brand-500) 55%, transparent);
    }

    h1 {
      margin: 0;
      font-size: 2rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }

    .highlight {
      background: linear-gradient(90deg, #93c5fd, #c084fc, #f472b6);
      background-clip: text;
      -webkit-background-clip: text;
      color: transparent;
    }

    .subheadline {
      margin: 16px 0 0;
      color: rgb(255 255 255 / 0.65);
      font-size: 0.95rem;
      line-height: 1.55;
    }

    .brand-panel__pills {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;
      margin-top: 28px;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 7px 14px;
      border-radius: 999px;
      border: 1px solid rgb(255 255 255 / 0.12);
      background: rgb(255 255 255 / 0.05);
      font-size: 0.78rem;
      font-weight: 600;
      color: rgb(255 255 255 / 0.85);
      white-space: nowrap;

      mat-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
        color: var(--brand-500);
        flex-shrink: 0;
      }
    }

    .brand-panel__stats {
      display: flex;
      gap: 28px;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid rgb(255 255 255 / 0.1);
    }

    .stat__value {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 800;
      background: linear-gradient(90deg, #93c5fd, #c084fc);
      background-clip: text;
      -webkit-background-clip: text;
      color: transparent;
    }

    .stat__label {
      margin: 2px 0 0;
      font-size: 0.72rem;
      color: rgb(255 255 255 / 0.55);
    }

    .brand-panel__divider {
      width: 100%;
      max-width: 320px;
      height: 1px;
      margin-top: 28px;
      background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.16), transparent);
    }

    .brand-panel__testimonial {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 22px 0 0;
      color: rgb(255 255 255 / 0.6);
      font-size: 0.82rem;
      line-height: 1.5;

      mat-icon {
        flex-shrink: 0;
        font-size: 17px;
        width: 17px;
        height: 17px;
        color: #34d399;
      }
    }

    .brand-panel__footer {
      position: absolute;
      bottom: 28px;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 0.72rem;
      color: rgb(255 255 255 / 0.35);
    }
  `,
})
export class AuthBrandPanel {
  /** Hangi çeviri anahtar kümesi kullanılsın: `auth.brandPanel.loginHeadline*` ya da `registerHeadline*`. */
  readonly variant = input<'login' | 'register'>('login');

  protected readonly pills = PILLS;
  protected readonly stats = STATS;
  protected readonly year = new Date().getFullYear();
}
