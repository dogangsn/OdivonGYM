import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Henüz inşa edilmemiş bir bölüm için tutarlı, "boş" hissettirmeyen durum
 * ekranı. Faz 2+'da gerçek içerikle değiştirilecek sayfalar bunu kullanır.
 * Odivon Design System'in empty-state kart deseniyle stilize edilir.
 */
@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="font-sans flex flex-col items-center text-center gap-1.5 max-w-md mx-auto my-12 p-10 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
    >
      <span
        class="w-14 h-14 mb-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center"
      >
        <mat-icon class="icon-size-7">{{ icon() }}</mat-icon>
      </span>
      <h2 class="m-0 text-lg font-bold text-slate-900 dark:text-white">{{ title() }}</h2>
      <p class="m-0 mb-5 text-sm text-slate-500 dark:text-slate-400">{{ description() }}</p>
      <button
        type="button"
        (click)="notify()"
        class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2"
      >
        <mat-icon class="icon-size-4">notifications</mat-icon>
        Hazır olunca haber ver
      </button>
    </div>
  `,
})
export class ComingSoon {
  private readonly snackBar = inject(MatSnackBar);

  readonly icon = input('construction');
  readonly title = input.required<string>();
  readonly description = input('Bu bölüm bir sonraki fazda aktif olacak.');

  notify(): void {
    this.snackBar.open('Not edildi — bu bölüm hazır olduğunda seni bilgilendireceğiz.', 'Kapat', {
      duration: 3000,
    });
  }
}
