import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth/auth.service';
import { LogoMark } from '../../../shared/components/logo-mark/logo-mark';

@Component({
  selector: 'app-trial-expired',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, LogoMark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trial-expired.html',
  styleUrl: './trial-expired.scss',
})
export class TrialExpired {
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  protected readonly heading = computed(() =>
    this.auth.membershipStatus() === 'cancelled' ? 'Üyeliğin iptal edildi' : 'Deneme süren doldu',
  );

  protected readonly message = computed(() =>
    this.auth.membershipStatus() === 'cancelled'
      ? 'Antrenmana devam etmek için üyeliğini yeniden aktifleştirmen gerekiyor.'
      : '14 günlük ücretsiz denemen sona erdi. Antrenmanına devam etmek için bir paket seç.',
  );

  notifyComingSoon(): void {
    this.snackBar.open('Paket satın alma akışı bir sonraki fazda geliyor! 🚀', 'Kapat', {
      duration: 3000,
    });
  }

  async logOut(): Promise<void> {
    await this.auth.logOut();
    await this.router.navigateByUrl('/auth/login');
  }
}
