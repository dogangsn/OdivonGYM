import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AppLockService, PinLength } from '../../../core/services/app-lock.service';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-lock-setup-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-lock-setup-modal.html',
})
export class AppLockSetupModal {
  protected readonly lockService = inject(AppLockService);
  private readonly alert = inject(AlertService);

  protected readonly selectedLength = signal<PinLength>(4);
  protected readonly newPin = signal<string>('');
  protected readonly confirmPin = signal<string>('');
  protected readonly showPin = signal<boolean>(false);
  protected readonly isSaving = signal<boolean>(false);
  protected readonly errorMessage = signal<string>('');

  selectLength(len: PinLength): void {
    this.selectedLength.set(len);
    this.newPin.set('');
    this.confirmPin.set('');
    this.errorMessage.set('');
  }

  onPinInput(event: Event, field: 'new' | 'confirm'): void {
    const input = event.target as HTMLInputElement;
    // Sadece sayısal karakterleri tut
    let val = input.value.replace(/\D/g, '');
    const maxLen = this.selectedLength();

    if (val.length > maxLen) {
      val = val.slice(0, maxLen);
    }

    input.value = val;
    if (field === 'new') {
      this.newPin.set(val);
    } else {
      this.confirmPin.set(val);
    }

    this.errorMessage.set('');
  }

  async save(): Promise<void> {
    const pin = this.newPin().trim();
    const confirm = this.confirmPin().trim();
    const len = this.selectedLength();

    if (!pin) {
      this.errorMessage.set(`Lütfen ${len} haneli bir PIN kodu giriniz.`);
      return;
    }

    if (pin.length !== len) {
      this.errorMessage.set(`PIN kodu tam olarak ${len} haneli olmalıdır (Şu an: ${pin.length}).`);
      return;
    }

    if (pin !== confirm) {
      this.errorMessage.set('Girdiğiniz PIN kodları birbiriyle eşleşmiyor.');
      return;
    }

    this.isSaving.set(true);
    try {
      const ok = await this.lockService.setPin(pin, len);
      if (ok) {
        this.newPin.set('');
        this.confirmPin.set('');
        this.errorMessage.set('');
      }
    } finally {
      this.isSaving.set(false);
    }
  }

  async removeLock(): Promise<void> {
    const ok = await this.alert.actionConfirm(
      'Kilit PIN Kodunu Kaldır',
      'Uygulama kilit koruması devre dışı bırakılacaktır. Onaylıyor musunuz?',
      'Evet, Kaldır',
      'warning',
    );
    if (ok) {
      this.lockService.removePin();
      this.lockService.closeSetupModal();
    }
  }

  close(): void {
    this.lockService.closeSetupModal();
    this.newPin.set('');
    this.confirmPin.set('');
    this.errorMessage.set('');
  }
}
