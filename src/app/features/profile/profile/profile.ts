import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth/auth.service';
import { COUNTRIES } from '../../../core/data/countries';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { TrialBadge } from '../../../shared/components/trial-badge/trial-badge';
import { formatDate } from '../../../shared/ui/ui-utils';
import { ProfileEditDialog } from '../profile-edit-dialog';

const GENDER_LABEL: Record<string, string> = {
  female: 'Kadın',
  male: 'Erkek',
  unspecified: 'Belirtilmemiş',
};

const LANGUAGE_LABEL: Record<string, string> = {
  tr: 'Türkçe',
  en: 'English',
  ru: 'Русский',
  nl: 'Nederlands',
  fr: 'Français',
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [MatIconModule, PageHeader, TrialBadge, ProfileEditDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans">
      <app-page-header title="Profil & Ayarlar" icon="person" description="Hesap bilgilerin ve üyelik durumun." />

      <div class="odv-card flex items-center gap-4 p-5 mb-4">
        <span
          class="w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0"
        >
          <mat-icon class="icon-size-8">account_circle</mat-icon>
        </span>
        <div class="flex-1 min-w-0">
          <p class="m-0 font-bold text-base text-slate-900 dark:text-white">
            {{ auth.profile()?.displayName || 'Üye' }}
          </p>
          <p class="m-0 mt-0.5 text-sm text-slate-500 dark:text-slate-400">{{ auth.profile()?.email }}</p>
          <div class="mt-2">
            <app-trial-badge />
          </div>
        </div>
        <button type="button" class="odv-btn-ghost inline-flex items-center gap-2" (click)="editing.set(true)">
          <mat-icon class="icon-size-4">edit</mat-icon>
          Düzenle
        </button>
      </div>

      <div class="odv-card p-6">
        <h2 class="m-0 mb-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Kişisel Bilgiler</h2>
        <dl class="m-0 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          @for (row of rows(); track row.label) {
            <div>
              <dt class="text-xs text-slate-400">{{ row.label }}</dt>
              <dd class="m-0 mt-0.5 font-semibold text-slate-900 dark:text-white">{{ row.value }}</dd>
            </div>
          }
        </dl>
      </div>
    </div>

    <app-profile-edit-dialog [open]="editing()" (closed)="onClosed($event)" />
  `,
})
export class Profile {
  protected readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly editing = signal(false);

  protected readonly rows = computed(() => {
    const p = this.auth.profile();
    const country = COUNTRIES.find((c) => c.code === p?.country)?.name;
    return [
      { label: 'Ad Soyad', value: p?.displayName || '—' },
      { label: 'E-posta', value: p?.email || '—' },
      { label: 'Telefon', value: p?.phone || '—' },
      { label: 'Doğum Tarihi', value: formatDate(p?.birthDate) },
      { label: 'Cinsiyet', value: GENDER_LABEL[p?.gender ?? 'unspecified'] },
      { label: 'Ülke', value: country ?? '—' },
      { label: 'Arayüz Dili', value: LANGUAGE_LABEL[p?.language ?? ''] ?? '—' },
      { label: 'Paket', value: p?.packageLabel || '—' },
      { label: 'Üyelik Bitişi', value: formatDate(p?.membershipEndsAt) },
    ];
  });

  protected onClosed(saved: boolean): void {
    this.editing.set(false);
    if (saved) this.snackBar.open('Profilin güncellendi.', 'Kapat', { duration: 3000 });
  }
}
