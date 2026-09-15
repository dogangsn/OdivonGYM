import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth/auth.service';
import { toAuthErrorMessage } from '../../../core/auth/auth-error.util';
import { LogoMark } from '../../../shared/components/logo-mark/logo-mark';
import { AuthBrandPanel } from '../../../shared/components/auth-brand-panel/auth-brand-panel';
import { environment } from '../../../../environments/environment';

/** Sadece dev ortamında: "Demo Bilgilerini Otomatik Doldur" butonuyla doldurulur. */
const DEMO_CREDENTIALS = { email: 'demo@odivongym.app', password: 'Demo123456!' };

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    LogoMark,
    AuthBrandPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly isDev = !environment.production;

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [true],
  });

  readonly submitting = signal(false);
  readonly googleSubmitting = signal(false);
  readonly resettingPassword = signal(false);
  readonly errorMessage = signal('');
  readonly hidePassword = signal(true);

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage.set('');
    this.submitting.set(true);
    try {
      const { email, password, rememberMe } = this.form.getRawValue();
      await this.auth.signInWithEmail(email, password, rememberMe);
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      this.errorMessage.set(toAuthErrorMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }

  async continueWithGoogle(): Promise<void> {
    if (this.googleSubmitting()) return;
    this.errorMessage.set('');
    this.googleSubmitting.set(true);
    try {
      await this.auth.signInWithGoogle();
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      this.errorMessage.set(toAuthErrorMessage(error));
    } finally {
      this.googleSubmitting.set(false);
    }
  }

  async forgotPassword(): Promise<void> {
    const email = this.form.controls.email.value.trim();
    if (!email || this.form.controls.email.invalid) {
      this.snackBar.open('Önce e-posta adresini gir, sonra sıfırlama bağlantısı gönderelim.', 'Kapat', {
        duration: 3000,
      });
      return;
    }
    if (this.resettingPassword()) return;
    this.resettingPassword.set(true);
    try {
      await this.auth.sendPasswordReset(email);
      this.snackBar.open(`${email} adresine şifre sıfırlama bağlantısı gönderildi.`, 'Kapat', {
        duration: 4000,
      });
    } catch (error) {
      this.snackBar.open(toAuthErrorMessage(error), 'Kapat', { duration: 4000 });
    } finally {
      this.resettingPassword.set(false);
    }
  }

  fillDemoCredentials(): void {
    this.form.patchValue(DEMO_CREDENTIALS);
  }
}
