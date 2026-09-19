import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { ProfileService } from './profile.service';
import { toAuthErrorMessage } from '../../core/auth/auth-error.util';
import { TranslocoService } from '@jsverse/transloco';
import { UserProfile, Gender } from '../../core/models/user-profile.model';

@Component({
  selector: 'app-profile-edit-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-edit-dialog.html',
  styleUrl: './profile-edit-dialog.scss',
})
export class ProfileEditDialog {
  private readonly fb = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly transloco = inject(TranslocoService);

  readonly open = input(false);
  readonly closed = output<boolean>();

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.pattern(/^[0-9+()\s-]{7,20}$/)]],
    gender: ['unspecified' as Gender],
    birthDate: [''],
    country: [''],
    language: [''],
    notes: [''],
  });

  constructor() {
    effect(() => {
      const profile = this.auth.profile();
      if (profile && this.open()) {
        this.errorMessage.set('');
        this.form.reset({
          displayName: profile.displayName ?? '',
          phone: profile.phone ?? '',
          gender: profile.gender ?? 'unspecified',
          birthDate: profile.birthDate ? this.toDateInputValue(profile.birthDate) : '',
          country: profile.country ?? '',
          language: profile.language ?? '',
          notes: profile.notes ?? '',
        });
      }
    });
  }

  private toDateInputValue(ts: any): string {
    if (!ts) return '';
    const d = ts.toDate?.() || new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage.set('');
    this.submitting.set(true);

    try {
      const value = this.form.getRawValue();
      await this.profileService.updateProfile({
        displayName: value.displayName.trim(),
        phone: value.phone.trim(),
        gender: value.gender,
        birthDate: value.birthDate ? new Date(value.birthDate) : undefined,
        country: value.country,
        language: value.language,
        notes: value.notes.trim(),
      });

      this.closed.emit(true);
    } catch (error) {
      this.errorMessage.set(toAuthErrorMessage(error, (key) => this.transloco.translate(key)));
    } finally {
      this.submitting.set(false);
    }
  }

  cancel(): void {
    this.closed.emit(false);
  }
}
