import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { IdentityApi } from '../../../core/api/identity.api';
import { toAuthErrorMessage } from '../../../core/auth/auth-error.util';
import { LanguageService, LANGUAGE_NAMES } from '../../../core/i18n/language.service';
import { COUNTRIES, DEFAULT_COUNTRY_CODE, SupportedLanguage, findCountry } from '../../../core/data/countries';
import { LogoMark } from '../../../shared/components/logo-mark/logo-mark';

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return password && confirmPassword && password !== confirmPassword
    ? { passwordMismatch: true }
    : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    LogoMark,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly identity = inject(IdentityApi);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);
  protected readonly language = inject(LanguageService);

  protected readonly countries = COUNTRIES;
  protected readonly languageNames = LANGUAGE_NAMES;
  protected readonly languages: SupportedLanguage[] = ['tr', 'en', 'ru', 'nl', 'fr'];
  protected readonly currentYear = new Date().getFullYear();

  readonly form = this.fb.nonNullable.group(
    {
      tenantName: ['', [Validators.required, Validators.minLength(2)]],
      displayName: ['', [Validators.required, Validators.minLength(2)]],
      country: [DEFAULT_COUNTRY_CODE, [Validators.required]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9\s]{7,14}$/)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator },
  );

  readonly submitting = signal(false);
  readonly resending = signal(false);
  readonly errorMessage = signal('');
  readonly hidePassword = signal(true);
  readonly hideConfirmPassword = signal(true);
  readonly registeredSuccess = signal<{ email: string; displayName: string } | null>(null);

  /** Telefon kutusunun başındaki salt-okunur çevirme kodu — seçili ülkeye göre. */
  protected readonly dialCode = signal(findCountry(DEFAULT_COUNTRY_CODE)?.dialCode ?? '+90');

  onCountryChange(code: string): void {
    const country = findCountry(code);
    if (!country) return;
    this.dialCode.set(country.dialCode);
    this.language.suggestLanguage(country.language);
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage.set('');
    this.submitting.set(true);
    try {
      const { tenantName, email, password, displayName, country, phone } = this.form.getRawValue();
      const result = await this.auth.signUpWithEmail({
        tenantName,
        email,
        password,
        displayName,
        country,
        phone: `${this.dialCode()} ${phone}`.trim(),
        language: this.language.current(),
      });
      this.registeredSuccess.set({ email: result.email, displayName: result.displayName });
    } catch (error) {
      this.errorMessage.set(toAuthErrorMessage(error, (key) => this.transloco.translate(key)));
    } finally {
      this.submitting.set(false);
    }
  }

  async resendVerification(): Promise<void> {
    const successData = this.registeredSuccess();
    if (!successData?.email || this.resending()) return;
    this.resending.set(true);
    try {
      await firstValueFrom(this.identity.resendVerification(successData.email));
      this.snackBar.open(
        this.transloco.translate('auth.registerSuccess.resendSuccess'),
        this.transloco.translate('common.close'),
        { duration: 4000 },
      );
    } catch {
      this.snackBar.open(
        this.transloco.translate('auth.verifyEmail.resendError'),
        this.transloco.translate('common.close'),
        { duration: 4000 },
      );
    } finally {
      this.resending.set(false);
    }
  }
}

