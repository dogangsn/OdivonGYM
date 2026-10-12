import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Auth, applyActionCode } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { IdentityApi } from '../../../core/api/identity.api';
import { AuthService } from '../../../core/auth/auth.service';
import { LogoMark } from '../../../shared/components/logo-mark/logo-mark';

type VerificationState = 'loading' | 'success' | 'error' | 'idle';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatIconModule,
    LogoMark,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss',
})
export class VerifyEmail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly identity = inject(IdentityApi);
  private readonly auth = inject(Auth);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  readonly state = signal<VerificationState>('loading');
  readonly verifiedEmail = signal<string | null>(null);
  readonly errorMessage = signal<string>('');
  readonly resending = signal(false);
  readonly currentYear = new Date().getFullYear();
  readonly isLoggedIn = computed(() => Boolean(this.authService.profile()));

  readonly resendForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParams;
    const token = params['token'];
    const oobCode = params['oobCode'];

    if (token) {
      await this.verifyWithBackendToken(token);
    } else if (oobCode) {
      await this.verifyWithFirebaseActionCode(oobCode);
    } else {
      this.state.set('idle');
    }
  }

  private async verifyWithBackendToken(token: string): Promise<void> {
    this.state.set('loading');
    try {
      const res = await firstValueFrom(this.identity.verifyEmail(token));
      this.verifiedEmail.set(res.email || null);
      this.state.set('success');
    } catch (err: any) {
      this.state.set('error');
      const msg = err?.error?.message || this.transloco.translate('auth.verifyEmail.errorDesc');
      this.errorMessage.set(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  }

  private async verifyWithFirebaseActionCode(oobCode: string): Promise<void> {
    this.state.set('loading');
    try {
      await applyActionCode(this.auth, oobCode);
      this.state.set('success');
    } catch (err: any) {
      this.state.set('error');
      this.errorMessage.set(
        err?.message || this.transloco.translate('auth.verifyEmail.errorDesc'),
      );
    }
  }

  async resendLink(): Promise<void> {
    if (this.resendForm.invalid || this.resending()) {
      this.resendForm.markAllAsTouched();
      return;
    }
    const email = this.resendForm.controls.email.value.trim();
    this.resending.set(true);
    try {
      await firstValueFrom(this.identity.resendVerification(email));
      this.snackBar.open(
        this.transloco.translate('auth.verifyEmail.resendSuccess'),
        this.transloco.translate('common.close'),
        { duration: 5000 },
      );
      this.resendForm.reset();
    } catch {
      this.snackBar.open(
        this.transloco.translate('auth.verifyEmail.resendError'),
        this.transloco.translate('common.close'),
        { duration: 4500 },
      );
    } finally {
      this.resending.set(false);
    }
  }
}
