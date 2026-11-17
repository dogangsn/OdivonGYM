import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Yükleyici çeşitleri:
 * - `aura`:  Odivon amblemi (eğik halka) üzerinde marka gradyanlı ışık dolaşır.
 * - `orbit`: ince ışık halkası döner, ucunda parlayan bir nokta.
 * - `pulse`: ritim çubukları (nabız / tekrar sayacı hissi).
 * - `line`:  `orbit` ile aynı çizilir (geriye dönük uyum).
 * Sayfa içi küçük yükleyicilerde kullanılır; tam ekran yükleme için bkz. LoadingStage.
 */
export type GymLoaderVariant = 'aura' | 'orbit' | 'pulse' | 'line';

/** Uygulamanın her yerinde kullanılan varsayılan çeşit. Değiştirmek için tek yer burası. */
export const DEFAULT_GYM_LOADER_VARIANT: GymLoaderVariant = 'orbit';

const VARIANTS: readonly GymLoaderVariant[] = ['aura', 'orbit', 'pulse', 'line'];

/** Karşılaştırma için tarayıcıda geçici seçim: localStorage `odivon-loader`. */
export function resolveGymLoaderVariant(): GymLoaderVariant {
  try {
    const value = localStorage.getItem('odivon-loader') as GymLoaderVariant | null;
    if (value && VARIANTS.includes(value)) return value;
  } catch {
    // localStorage yoksa varsayılan
  }
  return DEFAULT_GYM_LOADER_VARIANT;
}

let nextId = 0;

@Component({
  selector: 'app-gym-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'gym-loader gym-loader--' + size()",
  },
  template: `
    <div class="gl" [class.gl--inline]="inline()">
      @switch (shape()) {
        @case ('aura') {
          <div class="aura" aria-hidden="true">
            <span class="aura__glow"></span>
            <svg viewBox="0 0 64 64" class="aura__svg">
              <defs>
                <linearGradient [attr.id]="gradId" x1="10%" y1="0%" x2="90%" y2="100%">
                  <stop offset="0%" class="stop-cyan" />
                  <stop offset="55%" class="stop-violet" />
                  <stop offset="100%" class="stop-deep" />
                </linearGradient>
              </defs>
              <g transform="rotate(35 32 32)">
                <ellipse cx="32" cy="32" rx="15" ry="19" class="aura__track" />
                <ellipse
                  cx="32"
                  cy="32"
                  rx="15"
                  ry="19"
                  pathLength="100"
                  class="aura__runner"
                  [attr.stroke]="'url(#' + gradId + ')'"
                />
              </g>
            </svg>
          </div>
        }
        @case ('orbit') {
          <div class="orbit" aria-hidden="true">
            <span class="orbit__ring"></span>
          </div>
        }
        @case ('pulse') {
          <div class="pulse" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        }
      }

      @if (message()) {
        <p class="gl__message">{{ message() }}</p>
      }
      @if (submessage()) {
        <p class="gl__sub">{{ submessage() }}</p>
      }
    </div>
  `,
  styleUrl: './gym-loader.scss',
})
export class GymLoader {
  readonly message = input<string>('Veriler yükleniyor…');
  readonly submessage = input<string>('');
  readonly inline = input<boolean>(false);
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  /** Boş bırakılırsa DEFAULT_GYM_LOADER_VARIANT (veya tarayıcıdaki geçici seçim) kullanılır. */
  readonly variant = input<GymLoaderVariant | null>(null);
  /** Eski kullanım için tutuldu; renkler artık temadan gelir. */
  readonly dark = input<boolean>(true);

  /** `line` bileşen içinde halka olarak çizilir. */
  protected readonly shape = computed(() => {
    const v = this.variant() ?? resolveGymLoaderVariant();
    return v === 'line' ? 'orbit' : v;
  });

  protected readonly gradId = `gym-loader-grad-${nextId++}`;
}
