import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
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
  imports: [MatIconModule, MatButtonModule, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Paketler"
      icon="card_membership"
      description="Sana uygun üyelik paketini seç — ödeme entegrasyonu (Stripe/Iyzico) bir sonraki fazda aktif olacak."
    />

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      @for (tier of tiers; track tier.name) {
        <div class="tier" [class.tier--highlight]="tier.highlight">
          @if (tier.highlight) {
            <span class="tier__badge">En popüler</span>
          }
          <p class="tier__name">{{ tier.name }}</p>
          <p class="tier__price">
            {{ tier.price }} <span>{{ tier.period }}</span>
          </p>
          <ul class="tier__perks">
            @for (perk of tier.perks; track perk) {
              <li>
                <mat-icon>check_circle</mat-icon>
                {{ perk }}
              </li>
            }
          </ul>
          <button
            mat-flat-button
            [color]="tier.highlight ? 'primary' : undefined"
            class="!w-full !rounded-xl"
            type="button"
            (click)="notify(tier.name)"
          >
            Seç
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .tier {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 24px 20px;
      border-radius: 20px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-low);
    }

    .tier--highlight {
      border-color: var(--mat-sys-primary);
      box-shadow: 0 16px 40px -24px color-mix(in srgb, var(--brand-500) 60%, transparent);
    }

    .tier__badge {
      position: absolute;
      top: -12px;
      left: 20px;
      padding: 3px 10px;
      border-radius: 999px;
      background: var(--brand-gradient);
      color: white;
      font-size: 11px;
      font-weight: 700;
    }

    .tier__name {
      margin: 0;
      font-weight: 700;
      color: var(--mat-sys-on-surface-variant);
    }

    .tier__price {
      margin: 0;
      font-size: 1.6rem;
      font-weight: 800;

      span {
        font-size: 0.8rem;
        font-weight: 500;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .tier__perks {
      list-style: none;
      margin: 0 0 8px;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;

      li {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
        color: var(--mat-sys-on-surface-variant);
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: var(--mat-sys-primary);
        flex-shrink: 0;
      }
    }
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
