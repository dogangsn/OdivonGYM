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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { toAuthErrorMessage } from '../../../core/auth/auth-error.util';
import { LanguageService, LANGUAGE_NAMES } from '../../../core/i18n/language.service';
import { COUNTRIES, DEFAULT_COUNTRY_CODE, SupportedLanguage, findCountry } from '../../../core/data/countries';
import { LogoMark } from '../../../shared/components/logo-mark/logo-mark';
import { AuthBrandPanel } from '../../../shared/components/auth-brand-panel/auth-brand-panel';

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
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, LogoMark, AuthBrandPanel, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  protected readonly language = inject(LanguageService);


  protected readonly countries = COUNTRIES;
  protected readonly languageNames = LANGUAGE_NAMES;
  protected readonly supportedLanguages = ['tr', 'en', 'de', 'es', 'fr', 'ar'] as SupportedLanguage[];

  changeLanguage(lang: SupportedLanguage): void {
    this.language.setLanguage(lang);
  }


  readonly form = this.fb.nonNullable.group(
    {
      tenantName: ['', [Validators.required, Validators.minLength(2)]],
      displayName: ['', [Validators.required, Validators.minLength(2)]],
      country: [DEFAULT_COUNTRY_CODE, [Validators.required]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9\s]{7,14}$/)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator },
  );

  readonly submitting = signal(false);
  readonly googleSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly hidePassword = signal(true);

  /** Telefon kutusunun başındaki salt-okunur çevirme kodu — seçili ülkeye göre. */
  protected readonly dialCode = signal(findCountry(DEFAULT_COUNTRY_CODE)?.dialCode ?? '+90');

  /** Ülke seçilince dial code rozetini günceller ve arayüz dilini önerir (kullanıcı elle bir dil seçmediyse). */
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
      await this.auth.signUpWithEmail({
        tenantName,
        email,
        password,
        displayName,
        country,
        phone: `${this.dialCode()} ${phone}`.trim(),
        language: this.language.current(),
      });
      await this.router.navigateByUrl('/onboarding/wizard');
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
      await this.router.navigateByUrl('/onboarding/wizard');

    } catch (error) {
      this.errorMessage.set(toAuthErrorMessage(error, (key) => this.transloco.translate(key)));
    } finally {
      this.googleSubmitting.set(false);
    }
  }
}
