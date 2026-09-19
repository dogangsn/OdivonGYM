import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { LogoMark } from '../../../shared/components/logo-mark/logo-mark';

@Component({
  selector: 'app-trial-expired',
  standalone: true,
  imports: [LogoMark, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trial-expired.html',
  styleUrl: './trial-expired.scss',
})
export class TrialExpired {
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  protected readonly cancelled = computed(() => this.auth.membershipStatus() === 'cancelled');

  notifyComingSoon(): void {
    this.snackBar.open(
      this.transloco.translate('onboarding.trialExpired.purchaseComingSoon'),
      this.transloco.translate('common.close'),
      { duration: 3000 },
    );
  }

  async logOut(): Promise<void> {
    await this.auth.logOut();
    await this.router.navigateByUrl('/auth/login');
  }
}
