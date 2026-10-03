import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, signal } from '@angular/core';

/**
 * Hafif SVG/HTML grafikler (kütüphane yok, paket boyutu artmaz). Renkler doğrulanmış kategorik
 * paletten sabit sırayla gelir (seri rengi sıraya değil varlığa bağlı), açık/koyu tema
 * `light-dark()` ile; değer ve etiket metinleri seri renginde değil metin renginde yazılır.
 */
export const CHART_SERIES = [
  'light-dark(#2a78d6, #3987e5)',
  'light-dark(#eb6834, #d95926)',
  'light-dark(#1baf7a, #199e70)',
  'light-dark(#eda100, #c98500)',
  'light-dark(#e87ba4, #d55181)',
  'light-dark(#008300, #008300)',
  'light-dark(#4a3aa7, #9085e9)',
  'light-dark(#e34948, #e66767)',
] as const;

export const seriesColor = (index: number) => CHART_SERIES[index % CHART_SERIES.length];

export interface BarDatum {
  label: string;
  value: number;
  /** Uzun etiket (ipucunda gösterilir). */
  hint?: string;
}

export interface LineSeries {
  name: string;
  values: number[];
  /** Kategorik palet sırası (varsayılan: dizideki sıra). Filtre değişince renk kaymasın diye. */
  colorIndex?: number;
}

export interface DonutSlice {
  label: string;
  value: number;
  colorIndex?: number;
}

const CHART_STYLES = `
  .odv-chart { --chart-grid: light-dark(#e7e5e4, #2e2d2b); --chart-ink: light-dark(#52514e, #c3c2b7);
    --chart-ink-strong: light-dark(#0b0b0b, #ffffff); --chart-surface: light-dark(#ffffff, #0f172a);
    color: var(--chart-ink); font-size: 11px; }
  .odv-chart-tip { position: absolute; z-index: 5; pointer-events: none; white-space: nowrap; padding: 6px 8px;
    border-radius: 8px; background: light-dark(#0f172a, #f8fafc); color: light-dark(#f8fafc, #0f172a);
    font-size: 11px; font-weight: 600; box-shadow: 0 4px 12px rgb(0 0 0 / 0.18); transform: translate(-50%, -100%); }
  .odv-chart-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
`;

/** Dikey çubuk grafik: tek seri, büyüklük karşılaştırması (ör. son 7 gün). */
@Component({
  selector: 'odv-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: [CHART_STYLES],
  template: `
    <div class="odv-chart relative" role="img" [attr.aria-label]="ariaLabel()">
      <div class="flex items-end gap-1.5" [style.height.px]="height()">
        @for (bar of bars(); track bar.label; let i = $index) {
          <div class="relative flex-1 h-full flex items-end cursor-default"
               (mouseenter)="hover.set(i)" (mouseleave)="hover.set(null)" (focus)="hover.set(i)" (blur)="hover.set(null)" tabindex="0">
            <div class="w-full rounded-t transition-opacity"
                 [style.height.%]="bar.percent"
                 [style.min-height.px]="bar.value > 0 ? 3 : 0"
                 [style.background]="color()"
                 [style.opacity]="hover() === null || hover() === i ? 1 : 0.45"></div>
            @if (hover() === i) {
              <div class="odv-chart-tip" [style.left.%]="50" [style.top.px]="-4">{{ bar.hint || bar.label }}: {{ format()(bar.value) }}</div>
            }
          </div>
        }
      </div>
      <div class="flex gap-1.5 mt-1.5">
        @for (bar of bars(); track bar.label) {
          <span class="flex-1 text-center truncate">{{ bar.label }}</span>
        }
      </div>
    </div>
  `,
})
export class OdvBarChart {
  readonly data = input.required<BarDatum[]>();
  readonly height = input(120);
  readonly colorIndex = input(0);
  readonly format = input<(value: number) => string>((value) => value.toLocaleString('tr-TR'));
  readonly ariaLabel = input('Çubuk grafik');

  protected readonly hover = signal<number | null>(null);
  protected readonly color = computed(() => seriesColor(this.colorIndex()));
  protected readonly bars = computed(() => {
    const data = this.data();
    const max = Math.max(0, ...data.map((d) => d.value));
    return data.map((d) => ({ ...d, percent: max > 0 ? (Math.max(0, d.value) / max) * 100 : 0 }));
  });
}

/** Çizgi grafik: zaman içinde değişim; birden çok seri tek eksende, imleç hizasında değerler. */
@Component({
  selector: 'odv-line-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: [CHART_STYLES],
  template: `
    <div class="odv-chart relative" role="img" [attr.aria-label]="ariaLabel()">
      @if (series().length > 1) {
        <div class="flex flex-wrap gap-x-4 gap-y-1 mb-2">
          @for (s of series(); track s.name; let i = $index) {
            <span class="inline-flex items-center gap-1.5"><span class="odv-chart-swatch" [style.background]="colorOf(s, i)"></span>{{ s.name }}</span>
          }
        </div>
      }
      <div class="relative" [style.height.px]="height()">
        <svg class="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          @for (g of [0, 50, 100]; track g) {
            <line x1="0" x2="100" [attr.y1]="g" [attr.y2]="g" stroke="var(--chart-grid)" stroke-width="1" vector-effect="non-scaling-stroke" />
          }
          @for (s of paths(); track s.name) {
            <polyline [attr.points]="s.points" fill="none" [attr.stroke]="s.color" stroke-width="2"
                      stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
          }
          @if (hover() !== null) {
            <line [attr.x1]="xOf(hover()!)" [attr.x2]="xOf(hover()!)" y1="0" y2="100" stroke="var(--chart-ink)"
                  stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
          }
        </svg>
        @if (hover() !== null) {
          @for (s of paths(); track s.name) {
            <span class="absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2"
                  [style.left.%]="xOf(hover()!)" [style.top.%]="s.ys[hover()!]" [style.background]="s.color"
                  style="box-shadow: 0 0 0 2px var(--chart-surface)"></span>
          }
          <div class="odv-chart-tip" [style.left.%]="clampTip(xOf(hover()!))" [style.top.px]="-6">
            <div>{{ labels()[hover()!] }}</div>
            @for (s of paths(); track s.name) {
              <div>{{ s.name }}: {{ format()(s.values[hover()!] || 0) }}</div>
            }
          </div>
        }
        <div class="absolute inset-0 flex">
          @for (l of labels(); track $index; let i = $index) {
            <div class="flex-1 h-full" (mouseenter)="hover.set(i)" (mouseleave)="hover.set(null)"></div>
          }
        </div>
      </div>
      <div class="flex justify-between mt-1.5">
        @for (l of labels(); track $index) {
          <span class="truncate">{{ l }}</span>
        }
      </div>
      <div class="mt-1 text-[10px]">En yüksek: {{ format()(max()) }}</div>
    </div>
  `,
})
export class OdvLineChart {
  readonly labels = input.required<string[]>();
  readonly series = input.required<LineSeries[]>();
  readonly height = input(140);
  readonly format = input<(value: number) => string>((value) => value.toLocaleString('tr-TR'));
  readonly ariaLabel = input('Çizgi grafik');

  protected readonly hover = signal<number | null>(null);
  protected readonly max = computed(() => Math.max(0, ...this.series().flatMap((s) => s.values)));

  protected readonly paths = computed(() => {
    const max = this.max() || 1;
    return this.series().map((s, index) => {
      const ys = s.values.map((v) => 100 - (Math.max(0, v) / max) * 96 - 2);
      return {
        name: s.name,
        values: s.values,
        color: this.colorOf(s, index),
        ys,
        points: ys.map((y, i) => `${this.xOf(i)},${y}`).join(' '),
      };
    });
  });

  protected xOf(index: number): number {
    const count = this.labels().length;
    return count <= 1 ? 50 : (index / (count - 1)) * 100;
  }

  protected clampTip(x: number): number {
    return Math.min(85, Math.max(15, x));
  }

  protected colorOf(s: LineSeries, index: number): string {
    return seriesColor(s.colorIndex ?? index);
  }
}

/** Halka grafik: bir bütünün parçaları (en fazla birkaç dilim), her dilim etiket ve yüzdeyle. */
@Component({
  selector: 'odv-donut-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: [CHART_STYLES],
  template: `
    <div class="odv-chart flex items-center gap-4" role="img" [attr.aria-label]="ariaLabel()">
      <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 42 42" class="shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--chart-grid)" stroke-width="6" />
        @for (s of slices(); track s.label) {
          <circle cx="21" cy="21" r="15.915" fill="none" [attr.stroke]="s.color" stroke-width="6"
                  [attr.stroke-dasharray]="s.dash" [attr.stroke-dashoffset]="s.offset"
                  [style.opacity]="hover() === null || hover() === s.label ? 1 : 0.45"
                  (mouseenter)="hover.set(s.label)" (mouseleave)="hover.set(null)">
            <title>{{ s.label }}: {{ s.value }} (%{{ s.percent }})</title>
          </circle>
        }
      </svg>
      <ul class="m-0 p-0 list-none space-y-1.5 min-w-0">
        @for (s of slices(); track s.label) {
          <li class="flex items-center gap-2" (mouseenter)="hover.set(s.label)" (mouseleave)="hover.set(null)">
            <span class="odv-chart-swatch" [style.background]="s.color"></span>
            <span class="truncate">{{ s.label }}</span>
            <strong class="ml-auto pl-2" style="color: var(--chart-ink-strong)">{{ s.value }}</strong>
            <span class="w-10 text-right">%{{ s.percent }}</span>
          </li>
        }
      </ul>
    </div>
  `,
})
export class OdvDonutChart {
  readonly data = input.required<DonutSlice[]>();
  readonly size = input(104);
  readonly ariaLabel = input('Halka grafik');

  protected readonly hover = signal<string | null>(null);
  protected readonly slices = computed(() => {
    const data = this.data().filter((d) => d.value > 0);
    const total = data.reduce((sum, d) => sum + d.value, 0);
    let offset = 0;
    // Dilimler arasında 1 birimlik boşluk (yüzey aralığı); tek dilimde boşluk yok.
    const gap = data.length > 1 ? 1 : 0;
    return data.map((d, index) => {
      const length = total ? (d.value / total) * 100 : 0;
      const slice = {
        label: d.label,
        value: d.value,
        percent: total ? Math.round((d.value / total) * 100) : 0,
        color: seriesColor(d.colorIndex ?? index),
        dash: `${Math.max(0, length - gap)} ${100 - Math.max(0, length - gap)}`,
        offset: `${offset}`,
      };
      offset -= length;
      return slice;
    });
  });
}
