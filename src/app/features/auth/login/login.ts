import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { toAuthErrorMessage } from '../../../core/auth/auth-error.util';
import { ThemeService } from '../../../core/services/theme.service';
import { LanguageService, LANGUAGE_NAMES } from '../../../core/i18n/language.service';
import { SupportedLanguage } from '../../../core/data/countries';
import { LogoMark } from '../../../shared/components/logo-mark/logo-mark';
import { environment } from '../../../../environments/environment';

/** Sadece dev ortamında: "Demo Bilgilerini Otomatik Doldur" butonuyla doldurulur. */
const DEMO_CREDENTIALS = { email: 'demo@odivongym.app', password: 'Demo123456!' };

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCheckboxModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    LogoMark,
    TranslocoPipe,
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
  private readonly transloco = inject(TranslocoService);
  protected readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);

  protected readonly languages: SupportedLanguage[] = ['tr', 'en', 'ru', 'nl', 'fr'];
  protected readonly languageNames = LANGUAGE_NAMES;

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
      this.errorMessage.set(toAuthErrorMessage(error, (key) => this.transloco.translate(key)));
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
      this.errorMessage.set(toAuthErrorMessage(error, (key) => this.transloco.translate(key)));
    } finally {
      this.googleSubmitting.set(false);
    }
  }

  async forgotPassword(): Promise<void> {
    const email = this.form.controls.email.value.trim();
    if (!email || this.form.controls.email.invalid) {
      this.snackBar.open(this.transloco.translate('loginExtra.needEmailFirst'), this.transloco.translate('common.close'), {
        duration: 3000,
      });
      return;
    }
    if (this.resettingPassword()) return;
    this.resettingPassword.set(true);
    try {
      await this.auth.sendPasswordReset(email);
      this.snackBar.open(
        this.transloco.translate('loginExtra.resetLinkSent', { email }),
        this.transloco.translate('common.close'),
        { duration: 4000 },
      );
    } catch (error) {
      this.snackBar.open(
        toAuthErrorMessage(error, (key) => this.transloco.translate(key)),
        this.transloco.translate('common.close'),
        { duration: 4000 },
      );
    } finally {
      this.resettingPassword.set(false);
    }
  }

  fillDemoCredentials(): void {
    this.form.patchValue(DEMO_CREDENTIALS);
  }
}
