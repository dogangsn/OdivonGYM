import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth/auth.service';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { ComingSoon } from '../../../shared/components/coming-soon/coming-soon';
import { TrialBadge } from '../../../shared/components/trial-badge/trial-badge';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [MatIconModule, PageHeader, ComingSoon, TrialBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans">
      <app-page-header title="Profil & Ayarlar" icon="person" description="Hesap bilgilerin ve üyelik durumun." />

      <div
        class="flex items-center gap-4 p-5 mb-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm"
      >
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
        <button
          type="button"
          disabled
          class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 text-xs font-bold inline-flex items-center gap-2 opacity-50 cursor-not-allowed"
        >
          <mat-icon class="icon-size-4">edit</mat-icon>
          Düzenle
        </button>
      </div>

      <app-coming-soon
        icon="tune"
        title="Profil düzenleme yakında burada"
        description="Ad, profil fotoğrafı, bildirim tercihleri ve dil ayarlarını buradan değiştirebileceksin."
      />
    </div>
  `,
})
export class Profile {
  protected readonly auth = inject(AuthService);
}
