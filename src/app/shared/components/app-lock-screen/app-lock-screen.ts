import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AppLockService } from '../../../core/services/app-lock.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-lock-screen',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-lock-screen.html',
  styleUrl: './app-lock-screen.scss',
})
export class AppLockScreen implements OnInit, OnDestroy {
  protected readonly lockService = inject(AppLockService);
  protected readonly auth = inject(AuthService);
  protected readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);

  protected readonly enteredDigits = signal<string[]>([]);
  protected readonly isShaking = signal<boolean>(false);
  protected readonly isVerifying = signal<boolean>(false);
  protected readonly isUnlocked = signal<boolean>(false);
  protected readonly errorMessage = signal<string>('');
  protected readonly currentTime = signal<string>('');
  protected readonly currentDate = signal<string>('');

  private timerInterval: any = null;

  protected readonly pinLength = computed(() => this.lockService.pinLength());
  protected readonly dotsArray = computed(() => Array.from({ length: this.pinLength() }));

  protected readonly userInitials = computed(() => {
    const name = this.auth.profile()?.displayName || 'Odivon';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  });

  ngOnInit(): void {
    this.updateClock();
    this.timerInterval = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  private updateClock(): void {
    const now = new Date();
    this.currentTime.set(
      now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    );
    this.currentDate.set(
      now.toLocaleDateString('tr-TR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    );
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (this.isVerifying() || this.isUnlocked()) return;

    if (event.key >= '0' && event.key <= '9') {
      event.preventDefault();
      this.pressDigit(event.key);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      this.backspace();
    } else if (event.key === 'Escape' || event.key === 'Delete') {
      event.preventDefault();
      this.clearDigits();
    }
  }

  pressDigit(digit: string): void {
    if (this.isVerifying() || this.isUnlocked()) return;
    this.errorMessage.set('');

    const current = this.enteredDigits();
    const targetLength = this.pinLength();

    if (current.length < targetLength) {
      const next = [...current, digit];
      this.enteredDigits.set(next);

      if (next.length === targetLength) {
        this.verifyEnteredPin(next.join(''));
      }
    }
  }

  backspace(): void {
    if (this.isVerifying() || this.isUnlocked()) return;
    this.errorMessage.set('');
    const current = this.enteredDigits();
    if (current.length > 0) {
      this.enteredDigits.set(current.slice(0, -1));
    }
  }

  clearDigits(): void {
    if (this.isVerifying() || this.isUnlocked()) return;
    this.enteredDigits.set([]);
    this.errorMessage.set('');
  }

  private async verifyEnteredPin(pin: string): Promise<void> {
    this.isVerifying.set(true);

    // Kısa estetik gecikme ile doğrulama hissi
    await new Promise((resolve) => setTimeout(resolve, 150));

    const ok = await this.lockService.unlock(pin);

    if (ok) {
      this.isUnlocked.set(true);
      this.errorMessage.set('');
      // Açılış geçişi
      setTimeout(() => {
        this.enteredDigits.set([]);
        this.isVerifying.set(false);
      }, 300);
    } else {
      this.triggerShake();
      this.errorMessage.set('Hatalı PIN kodu! Lütfen tekrar deneyin.');
      this.enteredDigits.set([]);
      this.isVerifying.set(false);
    }
  }

  private triggerShake(): void {
    this.isShaking.set(true);
    setTimeout(() => {
      this.isShaking.set(false);
    }, 500);
  }

  async logOut(): Promise<void> {
    await this.auth.logOut();
    this.lockService.resetLockState();
    await this.router.navigateByUrl('/auth/login');
  }
}
