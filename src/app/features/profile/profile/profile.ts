import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/auth/auth.service';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { ComingSoon } from '../../../shared/components/coming-soon/coming-soon';
import { TrialBadge } from '../../../shared/components/trial-badge/trial-badge';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, PageHeader, ComingSoon, TrialBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Profil & Ayarlar" icon="person" description="Hesap bilgilerin ve üyelik durumun." />

    <div class="profile-card">
      <span class="profile-card__avatar">
        <mat-icon>account_circle</mat-icon>
      </span>
      <div class="profile-card__info">
        <p class="name">{{ auth.profile()?.displayName || 'Üye' }}</p>
        <p class="email">{{ auth.profile()?.email }}</p>
        <div class="mt-2">
          <app-trial-badge />
        </div>
      </div>
      <button mat-stroked-button type="button" disabled class="!rounded-xl">
        <mat-icon>edit</mat-icon>
        Düzenle
      </button>
    </div>

    <app-coming-soon
      icon="tune"
      title="Profil düzenleme yakında burada"
      description="Ad, profil fotoğrafı, bildirim tercihleri ve dil ayarlarını buradan değiştirebileceksin."
    />
  `,
  styles: `
    .profile-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      margin-bottom: 8px;
      border-radius: 20px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-low);
    }

    .profile-card__avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);

      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
      }
    }

    .profile-card__info {
      flex: 1;
      min-width: 0;
    }

    .name {
      margin: 0;
      font-weight: 700;
      font-size: 1.05rem;
    }

    .email {
      margin: 2px 0 0;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.85rem;
    }
  `,
})
export class Profile {
  protected readonly auth = inject(AuthService);
}
