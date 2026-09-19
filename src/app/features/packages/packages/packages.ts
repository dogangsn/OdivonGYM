import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageHeader } from '../../../shared/components/page-header/page-header';

interface PackageTier {
  name: string;
  price: string;
  period: string;
  highlight?: boolean;
  perks: string[];
}

@Component({
  selector: 'app-packages',
  standalone: true,
  imports: [MatIconModule, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans">
      <app-page-header
        title="Paketler"
        icon="card_membership"
        description="Sana uygun üyelik paketini seç — ödeme entegrasyonu (Stripe/Iyzico) bir sonraki fazda aktif olacak."
      />

      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        @for (tier of tiers; track tier.name) {
          <div
            class="relative flex flex-col gap-2.5 p-6 rounded-2xl bg-white dark:bg-slate-900 border shadow-sm transition-all"
            [class]="
              tier.highlight
                ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
                : 'border-slate-200/80 dark:border-slate-800'
            "
          >
            @if (tier.highlight) {
              <span
                class="absolute -top-3 left-6 px-2.5 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[11px] font-bold"
              >
                En popüler
              </span>
            }
            <p class="m-0 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {{ tier.name }}
            </p>
            <p class="m-0 text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {{ tier.price }}
              <span class="text-sm font-semibold text-slate-400">{{ tier.period }}</span>
            </p>
            <ul class="list-none m-0 mb-2 p-0 flex flex-col gap-2 flex-1">
              @for (perk of tier.perks; track perk) {
                <li class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <mat-icon class="icon-size-4.5 text-indigo-500 flex-shrink-0" [svgIcon]="'heroicons_solid:check-circle'"></mat-icon>
                  {{ perk }}
                </li>
              }
            </ul>
            <button
              type="button"
              (click)="notify(tier.name)"
              class="w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              [class]="
                tier.highlight
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20'
                  : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              "
            >
              Seç
            </button>
          </div>
        }
      </div>
    </div>
  `,
})
export class Packages {
  private readonly snackBar = inject(MatSnackBar);

  protected readonly tiers: PackageTier[] = [
    { name: 'Aylık', price: '₺?', period: '/ ay', perks: ['Tüm ekipmanlara erişim', 'Grup derslerine katılım'] },
    {
      name: '3 Aylık',
      price: '₺?',
      period: '/ 3 ay',
      highlight: true,
      perks: ['Aylık pakete ek olarak', '%10 indirim', '1 PT seansı hediye'],
    },
    { name: '6 Aylık', price: '₺?', period: '/ 6 ay', perks: ['%20 indirim', '2 PT seansı hediye'] },
    { name: 'Yıllık', price: '₺?', period: '/ yıl', perks: ['%30 indirim', '4 PT seansı hediye', 'Öncelikli destek'] },
  ];

  notify(tierName: string): void {
    this.snackBar.open(`${tierName} paket seçimi ve ödeme akışı yakında aktif olacak! 🚀`, 'Kapat', {
      duration: 3000,
    });
  }
}
