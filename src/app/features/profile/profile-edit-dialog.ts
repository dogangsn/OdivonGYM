import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { COUNTRIES, SupportedLanguage } from '../../core/data/countries';
import { LanguageService } from '../../core/i18n/language.service';
import { Gender } from '../../core/models/user-profile.model';
import { Field } from '../../shared/ui/field';
import { SlideOver } from '../../shared/ui/slide-over';
import { firstError, fromDateInput, toDateInput } from '../../shared/ui/ui-utils';
import { ProfileService } from './profile.service';

@Component({
  selector: 'app-profile-edit-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, SlideOver, Field],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-slide-over
      [open]="open()"
      title="Profili Düzenle"
      submitLabel="Değişiklikleri Kaydet"
      [submitting]="submitting()"
      [errorMessage]="errorMessage()"
      (closed)="closed.emit(false)"
      (submitted)="submit()"
    >
      <div [formGroup]="form" class="space-y-4">
        <app-field
          label="Ad Soyad"
          [required]="true"
          [error]="err('displayName', { required: 'Ad soyad gerekli.', minlength: 'En az 2 karakter.' })"
        >
          <input type="text" formControlName="displayName" autocomplete="off" class="odv-input" />
        </app-field>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <app-field label="Telefon" [error]="err('phone', { pattern: 'Geçerli bir telefon numarası gir.' })">
            <input type="tel" formControlName="phone" autocomplete="off" class="odv-input" />
          </app-field>
          <app-field label="Doğum Tarihi">
            <input type="date" formControlName="birthDate" class="odv-input" />
          </app-field>
          <app-field label="Cinsiyet">
            <select formControlName="gender" class="odv-input">
              <option value="unspecified">Belirtmek istemiyorum</option>
              <option value="female">Kadın</option>
              <option value="male">Erkek</option>
            </select>
          </app-field>
          <app-field label="Ülke">
            <select formControlName="country" class="odv-input">
              <option value="">Seçilmedi</option>
              @for (c of countries; track c.code) {
                <option [value]="c.code">{{ c.name }}</option>
              }
            </select>
          </app-field>
          <app-field label="Arayüz Dili">
            <select formControlName="language" class="odv-input">
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
              <option value="ru">Русский</option>
              <option value="nl">Nederlands</option>
              <option value="fr">Français</option>
            </select>
          </app-field>
        </div>
      </div>
    </app-slide-over>
  `,
})
export class ProfileEditDialog {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly languageService = inject(LanguageService);

  readonly open = input(false);
  readonly closed = output<boolean>();

  protected readonly countries = COUNTRIES;
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.pattern(/^[0-9+()\s-]{7,20}$/)]],
    birthDate: [''],
    gender: ['unspecified' as Gender],
    country: [''],
    language: ['tr' as SupportedLanguage],
  });

  constructor() {
    // Panel her açıldığında formu mevcut profille doldur.
    effect(() => {
      if (this.open()) untracked(() => this.fill());
    });
  }

  private fill(): void {
    const p = this.auth.profile();
    this.errorMessage.set('');
    this.form.reset({
      displayName: p?.displayName ?? '',
      phone: p?.phone ?? '',
      birthDate: toDateInput(p?.birthDate),
      gender: p?.gender ?? 'unspecified',
      country: p?.country ?? '',
      language: (p?.language as SupportedLanguage) ?? this.languageService.current(),
    });
  }

  protected err(name: keyof typeof this.form.controls, messages: Record<string, string>): string {
    return firstError(this.form.controls[name], messages);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set('');
    try {
      const v = this.form.getRawValue();
      await this.service.updateProfile({
        displayName: v.displayName.trim(),
        phone: v.phone.trim(),
        gender: v.gender,
        birthDate: v.birthDate ? fromDateInput(v.birthDate) : null,
        country: v.country,
        language: v.language,
      });
      this.languageService.setLanguage(v.language);
      this.closed.emit(true);
    } catch {
      this.errorMessage.set('Kaydedilemedi, tekrar dene.');
    } finally {
      this.submitting.set(false);
    }
  }
}
