import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-trial-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (text()) {
      <span
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
        [class]="toneClasses()"
      >
        <span class="size-1.5 rounded-full bg-current"></span>
        {{ text() }}
      </span>
    }
  `,
})
export class TrialBadge {
  private readonly auth = inject(AuthService);

  private readonly tone = computed<'ok' | 'warn' | 'danger' | null>(() => {
    const status = this.auth.membershipStatus();
    if (status === 'active') return 'ok';
    if (status === 'trial') return this.auth.trialDaysLeft() <= 3 ? 'danger' : 'warn';
    if (status === 'expired' || status === 'cancelled') return 'danger';
    return null;
  });

  readonly text = computed(() => {
    const status = this.auth.membershipStatus();
    if (status === 'active') return 'Aktif Üyelik';
    if (status === 'trial') return `Denemede · ${this.auth.trialDaysLeft()} gün kaldı`;
    if (status === 'expired') return 'Deneme süresi bitti';
    if (status === 'cancelled') return 'Üyelik iptal edildi';
    return '';
  });

  readonly toneClasses = computed(() => {
    switch (this.tone()) {
      case 'ok':
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
      case 'warn':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
      case 'danger':
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-400';
      default:
        return 'bg-slate-500/15 text-slate-600 dark:text-slate-400';
    }
  });
}
