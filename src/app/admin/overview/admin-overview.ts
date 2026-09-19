import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PageHeader } from '../../shared/components/page-header/page-header';

type Accent = 'primary' | 'sky' | 'emerald' | 'amber';

interface AdminStat {
  icon: string;
  accent: Accent;
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}

const ACCENT_CLASSES: Record<Accent, string> = {
  primary: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
};

const STATS: AdminStat[] = [
  { icon: 'users', accent: 'primary', label: 'Toplam Üye', value: '—', hint: 'Firestore bağlanınca dolacak', highlight: true },
  { icon: 'arrow-trending-up', accent: 'emerald', label: 'Aktif Üyelik', value: '—', hint: 'Deneme + ücretli üyeler' },
  { icon: 'clock', accent: 'amber', label: 'Denemesi Bitenler', value: '—', hint: 'Son 7 gün' },
  { icon: 'banknotes', accent: 'sky', label: 'Bu Ay Gelir', value: '—', hint: 'Muhasebe modülü yakında' },
];

/**
 * Admin "Salon Durumu" özet ekranı — gerçek sayılar Firestore sorgularıyla
 * (üye sayısı, aylık gelir vb.) bir sonraki fazda buraya bağlanacak.
 */
@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [MatIconModule, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans">
      <app-page-header
        title="Salon Durumu"
        icon="space_dashboard"
        description="Üyelik, gelir ve doluluk durumuna tek ekrandan bak."
      />

      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        @for (stat of stats; track stat.label) {
          @if (stat.highlight) {
            <div
              class="p-6 rounded-2xl bg-gradient-to-br from-sky-400 via-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25"
            >
              <div class="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center">
                <mat-icon class="icon-size-5" [svgIcon]="'heroicons_solid:' + stat.icon"></mat-icon>
              </div>
              <div class="mt-4 text-4xl sm:text-5xl font-black tracking-tight leading-none">{{ stat.value }}</div>
              <div class="text-xs font-semibold text-white/85 mt-1">{{ stat.label }}</div>
              <div class="text-[11px] text-white/70 mt-2">{{ stat.hint }}</div>
            </div>
          } @else {
            <div
              class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all"
            >
              <div class="w-10 h-10 rounded-xl flex items-center justify-center" [class]="accentClasses[stat.accent]">
                <mat-icon class="icon-size-5" [svgIcon]="'heroicons_solid:' + stat.icon"></mat-icon>
              </div>
              <div class="mt-4 text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                {{ stat.value }}
              </div>
              <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">{{ stat.label }}</div>
              <div class="text-[11px] text-slate-400 dark:text-slate-500 mt-2">{{ stat.hint }}</div>
            </div>
          }
        }
      </div>

      <div
        class="flex gap-3 p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/50"
      >
        <mat-icon class="icon-size-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" [svgIcon]="'heroicons_solid:information-circle'"></mat-icon>
        <p class="m-0 text-sm text-slate-600 dark:text-slate-300">
          Bu sayılar şu an placeholder — üye/gelir verisi Firestore'a bağlandığında (Üye Kayıtları ve
          Muhasebe modülleriyle birlikte) burada gerçek zamanlı görünecek.
        </p>
      </div>
    </div>
  `,
})
export class AdminOverview {
  protected readonly stats = STATS;
  protected readonly accentClasses = ACCENT_CLASSES;
}
