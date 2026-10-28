import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { ChangePasswordService } from './change-password.service';

@Component({
  selector: 'app-change-password-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './change-password-modal.html',
})
export class ChangePasswordModal {
  protected readonly modalService = inject(ChangePasswordService);
  private readonly auth = inject(AuthService);
  private readonly alert = inject(AlertService);

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');

  readonly showCurrent = signal(false);
  readonly showNew = signal(false);
  readonly showConfirm = signal(false);

  readonly isSubmitting = signal(false);
  readonly isSuccess = signal(false);
  readonly errorMessage = signal<string | null>(null);

  get userEmail(): string {
    return this.auth.profile()?.email || '';
  }

  get userDisplayName(): string {
    return this.auth.profile()?.displayName || 'Kullanıcı';
  }

  generateRandomPassword(): void {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.newPassword.set(result);
    this.confirmPassword.set(result);
    this.showNew.set(true);
    this.showConfirm.set(true);
    this.errorMessage.set(null);
  }

  copyPassword(): void {
    const pass = this.newPassword();
    if (!pass) return;
    void navigator.clipboard.writeText(pass);
    this.alert.toastSuccess('Yeni şifre panoya kopyalandı.');
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.isSubmitting()) {
      this.close();
    }
  }

  close(): void {
    if (this.isSubmitting()) return;
    this.resetForm();
    this.modalService.close();
  }

  resetForm(): void {
    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.showCurrent.set(false);
    this.showNew.set(false);
    this.showConfirm.set(false);
    this.isSubmitting.set(false);
    this.isSuccess.set(false);
    this.errorMessage.set(null);
  }

  async submitChangePassword(): Promise<void> {
    const current = this.currentPassword().trim();
    const newPass = this.newPassword().trim();
    const confirm = this.confirmPassword().trim();

    this.errorMessage.set(null);

    if (!current) {
      this.errorMessage.set('Lütfen mevcut şifrenizi girin.');
      return;
    }

    if (!newPass) {
      this.errorMessage.set('Lütfen yeni şifrenizi girin.');
      return;
    }

    if (newPass.length < 6) {
      this.errorMessage.set('Yeni şifreniz en az 6 karakter uzunluğunda olmalıdır.');
      return;
    }

    if (newPass === current) {
      this.errorMessage.set('Yeni şifreniz mevcut şifrenizle aynı olamaz.');
      return;
    }

    if (newPass !== confirm) {
      this.errorMessage.set('Yeni şifre ve şifre tekrarı birbiriyle eşleşmiyor.');
      return;
    }

    this.isSubmitting.set(true);

    try {
      await this.auth.changePassword(current, newPass);
      this.isSuccess.set(true);
      this.alert.toastSuccess('Şifreniz başarıyla değiştirildi.');

      setTimeout(() => {
        this.close();
      }, 1400);
    } catch (err: any) {
      console.error('Şifre değiştirme hatası:', err);
      if (err?.code === 'INVALID_CURRENT_PASSWORD' || err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        this.errorMessage.set('Mevcut şifreniz hatalı. Lütfen kontrol edip tekrar deneyin.');
      } else if (err?.code === 'auth/weak-password') {
        this.errorMessage.set('Yeni şifre çok zayıf. Lütfen daha güçlü bir şifre belirleyin.');
      } else {
        this.errorMessage.set(err?.message || 'Şifre güncellenirken beklenmedik bir hata oluştu.');
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
