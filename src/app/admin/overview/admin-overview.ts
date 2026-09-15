import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PageHeader } from '../../shared/components/page-header/page-header';

interface AdminStat {
  icon: string;
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}

const STATS: AdminStat[] = [
  { icon: 'groups', label: 'Toplam Üye', value: '—', hint: 'Firestore bağlanınca dolacak', highlight: true },
  { icon: 'trending_up', label: 'Aktif Üyelik', value: '—', hint: 'Deneme + ücretli üyeler' },
  { icon: 'hourglass_bottom', label: 'Denemesi Bitenler', value: '—', hint: 'Son 7 gün' },
  { icon: 'payments', label: 'Bu Ay Gelir', value: '—', hint: 'Muhasebe modülü yakında' },
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
    <app-page-header
      title="Salon Durumu"
      icon="space_dashboard"
      description="Üyelik, gelir ve doluluk durumuna tek ekrandan bak."
    />

    <div class="stat-grid">
      @for (stat of stats; track stat.label) {
        <div class="stat-card" [class.stat-card--highlight]="stat.highlight">
          <span class="stat-card__icon">
            <mat-icon>{{ stat.icon }}</mat-icon>
          </span>
          <p class="stat-card__label">{{ stat.label }}</p>
          <p class="stat-card__value">{{ stat.value }}</p>
          <p class="stat-card__hint">{{ stat.hint }}</p>
        </div>
      }
    </div>

    <div class="notice">
      <mat-icon>info</mat-icon>
      <p>
        Bu sayılar şu an placeholder — üye/gelir verisi Firestore'a bağlandığında (Üye Kayıtları ve
        Muhasebe modülleriyle birlikte) burada gerçek zamanlı görünecek.
      </p>
    </div>
  `,
  styles: `
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }

    @media (min-width: 700px) {
      .stat-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }

    .stat-card {
      padding: 18px 18px 16px;
      border-radius: 18px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-low);
    }

    .stat-card__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      margin-bottom: 12px;
      border-radius: 10px;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .stat-card--highlight {
      border: none;
      background: var(--brand-gradient);
      color: white;

      .stat-card__icon {
        background: rgb(255 255 255 / 0.18);
        color: white;
      }

      .stat-card__label,
      .stat-card__hint {
        color: rgb(255 255 255 / 0.85);
      }
    }

    .stat-card__label {
      margin: 0;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
    }

    .stat-card__value {
      margin: 4px 0 0;
      font-size: 1.5rem;
      font-weight: 800;
    }

    .stat-card__hint {
      margin: 4px 0 0;
      font-size: 0.72rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .notice {
      display: flex;
      gap: 10px;
      padding: 14px 16px;
      border-radius: 14px;
      background: color-mix(in srgb, var(--brand-500) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--brand-500) 25%, transparent);

      mat-icon {
        flex-shrink: 0;
        color: var(--mat-sys-primary);
      }

      p {
        margin: 0;
        font-size: 0.85rem;
        color: var(--mat-sys-on-surface-variant);
      }
    }
  `,
})
export class AdminOverview {
  protected readonly stats = STATS;
}
