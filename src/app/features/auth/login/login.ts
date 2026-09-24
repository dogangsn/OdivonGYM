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

export interface DemoProfile {
  key: 'active' | 'expired';
  email: string;
  password: string;
  roleI18nKey: string;
  badgeI18nKey: string;
  descI18nKey: string;
  icon: string;
  accent: 'emerald' | 'amber';
}

export const DEMO_PROFILES: DemoProfile[] = [
  {
    key: 'active',
    email: 'demo@odivongym.app',
    password: 'Demo123456!',
    roleI18nKey: 'auth.login.demoActiveTitle',
    badgeI18nKey: 'auth.login.demoActiveBadge',
    descI18nKey: 'auth.login.demoActiveDesc',
    icon: 'verified_user',
    accent: 'emerald',
  },
  {
    key: 'expired',
    email: 'expired@odivongym.app',
    password: 'Demo123456!',
    roleI18nKey: 'auth.login.demoExpiredTitle',
    badgeI18nKey: 'auth.login.demoExpiredBadge',
    descI18nKey: 'auth.login.demoExpiredDesc',
    icon: 'history_toggle_off',
    accent: 'amber',
  },
];

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
  protected readonly demoProfiles = DEMO_PROFILES;
  protected readonly currentYear = new Date().getFullYear();

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
  readonly activeDemoKey = signal<'active' | 'expired' | null>(null);

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage.set('');
    this.submitting.set(true);
    try {
      const { email, password, rememberMe } = this.form.getRawValue();

      try {
        await this.auth.signInWithEmail(email, password, rememberMe);
      } catch (err: any) {
        // Demo hesaplar Firebase Auth'ta henüz oluşturulmamışsa tek tıkla otomatik oluştur
        const isDemo = email === 'demo@odivongym.app' || email === 'expired@odivongym.app';
        if (isDemo && (err?.code === 'auth/invalid-credential' || err?.code === 'auth/user-not-found')) {
          await this.auth.signUpWithEmail({
            tenantName: email === 'expired@odivongym.app' ? 'Odivon Pasif Salon' : 'Odivon Demo Salonu',
            email,
            password,
            displayName: email === 'expired@odivongym.app' ? 'Demo Pasif Üye' : 'Demo Yönetici',
            country: 'TR',
            phone: '+90 555 000 00 00',
            language: 'tr',
          });
        } else {
          throw err;
        }
      }

      if (email === 'expired@odivongym.app') {
        await this.router.navigateByUrl('/onboarding/trial-expired');
      } else {
        await this.router.navigateByUrl('/dashboard');
      }
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

  fillDemoCredentials(profile: DemoProfile): void {
    this.form.patchValue({
      email: profile.email,
      password: profile.password,
    });
    this.form.markAsDirty();
    this.activeDemoKey.set(profile.key);
    this.errorMessage.set('');

    const translatedRole = this.transloco.translate(profile.roleI18nKey);
    this.snackBar.open(
      this.transloco.translate('auth.login.demoFilledSnackbar', { role: translatedRole }),
      this.transloco.translate('common.close'),
      { duration: 2500 },
    );
  }
}
