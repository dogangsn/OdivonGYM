import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
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
  private readonly destroyRef = inject(DestroyRef);
  protected readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);

  protected readonly languages: SupportedLanguage[] = ['tr', 'en', 'ru', 'nl', 'fr'];
  protected readonly languageNames = LANGUAGE_NAMES;
  protected readonly currentYear = new Date().getFullYear();

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [true],
  });

  readonly submitting = signal(false);
  readonly resettingPassword = signal(false);
  readonly errorMessage = signal('');
  readonly failedAttempts = signal(0);
  readonly lockSecondsLeft = signal(0);
  private lockTimer: ReturnType<typeof setInterval> | null = null;

  /** Neden yeniden giriş istendiğini anlatır: sürüm güncellemesi ya da süresi dolan oturum. */
  readonly infoMessage = signal(
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('updated')
      ? 'Panel yeni sürüme güncellendi. Güvenliğiniz için lütfen yeniden giriş yapın.'
      : this.auth.sessionExpired()
        ? 'Oturum süreniz (30 gün) doldu. Lütfen yeniden giriş yapın.'
        : '',
  );
  readonly hidePassword = signal(true);

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.lockTimer) {
        clearInterval(this.lockTimer);
      }
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting() || this.lockSecondsLeft() > 0) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage.set('');
    this.submitting.set(true);
    try {
      const { email, password, rememberMe } = this.form.getRawValue();

      await this.auth.signInWithEmail(email, password, rememberMe);
      await this.auth.waitUntilReady();
      this.failedAttempts.set(0);

      if (!this.auth.onboardingCompleted()) {
        await this.router.navigateByUrl('/onboarding/wizard');
      } else if (this.auth.isTrialExpired() && !this.auth.canAccessApp()) {
        await this.router.navigateByUrl('/onboarding/trial-expired');
      } else {
        await this.router.navigateByUrl('/dashboard');
      }
    } catch (error) {
      const attempts = this.failedAttempts() + 1;
      this.failedAttempts.set(attempts);
      if (attempts >= 5) {
        this.startLockout(30);
      } else {
        this.errorMessage.set(toAuthErrorMessage(error, (key) => this.transloco.translate(key)));
      }
    } finally {
      this.submitting.set(false);
    }
  }

  private startLockout(seconds: number): void {
    if (this.lockTimer) {
      clearInterval(this.lockTimer);
    }
    this.lockSecondsLeft.set(seconds);
    this.errorMessage.set(
      this.transloco.translate('loginExtra.tooManyAttemptsWait', { seconds }),
    );
    this.lockTimer = setInterval(() => {
      const left = this.lockSecondsLeft() - 1;
      if (left <= 0) {
        if (this.lockTimer) {
          clearInterval(this.lockTimer);
        }
        this.lockTimer = null;
        this.lockSecondsLeft.set(0);
        this.failedAttempts.set(0);
        this.errorMessage.set('');
      } else {
        this.lockSecondsLeft.set(left);
        this.errorMessage.set(
          this.transloco.translate('loginExtra.tooManyAttemptsWait', { seconds: left }),
        );
      }
    }, 1000);
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

}
