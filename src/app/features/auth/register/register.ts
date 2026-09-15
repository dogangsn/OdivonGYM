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
import { AuthService } from '../../../core/auth/auth.service';
import { toAuthErrorMessage } from '../../../core/auth/auth-error.util';
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
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, LogoMark, AuthBrandPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group(
    {
      displayName: ['', [Validators.required, Validators.minLength(2)]],
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

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage.set('');
    this.submitting.set(true);
    try {
      const { email, password, displayName } = this.form.getRawValue();
      await this.auth.signUpWithEmail(email, password, displayName);
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
}
