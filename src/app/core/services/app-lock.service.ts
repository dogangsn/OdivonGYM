import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { AlertService } from './alert.service';

export type PinLength = 4 | 6;

interface StoredLockData {
  hash: string;
  salt: string;
  length: PinLength;
  isLocked: boolean;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AppLockService {
  private readonly auth = inject(AuthService);
  private readonly alert = inject(AlertService);

  // Reactive state
  readonly isLocked = signal<boolean>(false);
  readonly hasPin = signal<boolean>(false);
  readonly pinLength = signal<PinLength>(4);
  readonly isSetupModalOpen = signal<boolean>(false);

  private readonly storagePrefix = 'odivon_lock_';

  constructor() {
    this.restoreState();
  }

  private getStorageKey(): string {
    const user = this.auth.user();
    const uid = user?.uid || 'guest';
    return `${this.storagePrefix}${uid}`;
  }

  /**
   * Sayfa yüklendiğinde mevcut PIN ve kilit durumunu yükler.
   */
  restoreState(): void {
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      if (raw) {
        const data: StoredLockData = JSON.parse(raw);
        this.hasPin.set(!!data.hash);
        this.pinLength.set(data.length === 6 ? 6 : 4);
        // Eğer kullanıcı kilitliyken sayfayı yenilediyse kilitli kalmaya devam etsin
        if (data.isLocked && data.hash) {
          this.isLocked.set(true);
        }
      } else {
        this.hasPin.set(false);
        this.isLocked.set(false);
      }
    } catch {
      this.hasPin.set(false);
      this.isLocked.set(false);
    }
  }

  /**
   * Ekranı kilitler. PIN henüz tanımlanmamışsa PIN belirleme modalını açar.
   */
  lock(): void {
    if (!this.hasPin()) {
      this.openSetupModal();
      return;
    }
    this.isLocked.set(true);
    this.persistLockState(true);
  }

  /**
   * PIN belirleme / değiştirme modalını açar.
   */
  openSetupModal(): void {
    this.isSetupModalOpen.set(true);
  }

  closeSetupModal(): void {
    this.isSetupModalOpen.set(false);
  }

  /**
   * Yeni PIN belirler (4 veya 6 haneli, sadece rakamlardan oluşmalı).
   */
  async setPin(pin: string, length: PinLength): Promise<boolean> {
    const cleanPin = pin.trim();
    if (!/^\d+$/.test(cleanPin) || (cleanPin.length !== 4 && cleanPin.length !== 6)) {
      this.alert.toastError('PIN kodu sadece 4 veya 6 haneli sayısal bir değer olmalıdır.');
      return false;
    }

    if (cleanPin.length !== length) {
      this.alert.toastError(`Seçilen uzunluk (${length} hane) ile girilen PIN uyuşmuyor.`);
      return false;
    }

    try {
      const salt = this.generateSalt();
      const hash = await this.hashPin(cleanPin, salt);

      const data: StoredLockData = {
        hash,
        salt,
        length,
        isLocked: false,
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem(this.getStorageKey(), JSON.stringify(data));
      this.hasPin.set(true);
      this.pinLength.set(length);
      this.closeSetupModal();
      this.alert.toastSuccess(`Uygulama kilit PIN'i (${length} haneli) başarıyla kaydedildi.`);
      return true;
    } catch (err) {
      this.alert.toastError('PIN kaydedilirken bir hata oluştu.');
      return false;
    }
  }

  /**
   * Girilen PIN ile ekran kilidini açmayı dener.
   */
  async unlock(enteredPin: string): Promise<boolean> {
    const raw = localStorage.getItem(this.getStorageKey());
    if (!raw) {
      this.isLocked.set(false);
      return true;
    }

    try {
      const data: StoredLockData = JSON.parse(raw);
      const computedHash = await this.hashPin(enteredPin, data.salt);

      if (computedHash === data.hash) {
        this.isLocked.set(false);
        this.persistLockState(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Çıkış (logout) gibi durumlarda kilit durumunu kaldırır.
   */
  resetLockState(): void {
    this.isLocked.set(false);
    this.persistLockState(false);
  }

  /**
   * PIN kilidini tamamen kaldırır / devre dışı bırakır.
   */
  removePin(): void {
    localStorage.removeItem(this.getStorageKey());
    this.hasPin.set(false);
    this.isLocked.set(false);
    this.alert.toastSuccess('Uygulama kilit PIN kodu kaldırıldı.');
  }

  private persistLockState(locked: boolean): void {
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      if (raw) {
        const data: StoredLockData = JSON.parse(raw);
        data.isLocked = locked;
        localStorage.setItem(this.getStorageKey(), JSON.stringify(data));
      }
    } catch {
      // ignore
    }
  }

  private generateSalt(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  private async hashPin(pin: string, salt: string): Promise<string> {
    const enc = new TextEncoder();
    const data = enc.encode(`${salt}:${pin}:odivongym_secure_pin`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
