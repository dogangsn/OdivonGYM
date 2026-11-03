import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AlertService } from './alert.service';
import { GymBankService } from './gym-bank.service';
import { DailyCloseReminderSettings } from '../models/daily-close.model';

@Injectable({ providedIn: 'root' })
export class DailyCloseReminderService {
  private readonly bankService = inject(GymBankService);
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);

  readonly settings = signal<DailyCloseReminderSettings>({
    enabled: true,
    reminderTime: '22:00',
    days: ['0', '1', '2', '3', '4', '5', '6'],
    notifyInApp: true,
  });

  readonly isReminderModalOpen = signal(false);
  readonly lastNotifiedDate = signal<string>('');

  private intervalId: ReturnType<typeof setInterval> | null = null;

  init(): void {
    this.loadSettings();
    this.startClockMonitor();
  }

  async loadSettings(): Promise<void> {
    try {
      const res = await this.bankService.getReminderSettings();
      if (res) {
        this.settings.set(res);
      }
    } catch {
      // Use defaults if not set yet
    }
  }

  openSettings(): void {
    this.isReminderModalOpen.set(true);
  }

  closeSettings(): void {
    this.isReminderModalOpen.set(false);
  }

  async saveSettings(updated: Partial<DailyCloseReminderSettings>): Promise<void> {
    const current = this.settings();
    const payload = {
      enabled: updated.enabled ?? current.enabled,
      reminderTime: updated.reminderTime ?? current.reminderTime,
      days: updated.days ?? current.days,
      notifyInApp: updated.notifyInApp ?? current.notifyInApp,
    };
    const res = await this.bankService.updateReminderSettings(payload);
    this.settings.set(res);
    this.alertService.success('Gün sonu hatırlatma ayarları başarıyla kaydedildi.');
    this.closeSettings();
  }

  sendTestNotification(): void {
    this.triggerNotification(true);
  }

  private startClockMonitor(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.checkTime(), 30000); // Check every 30s
    this.checkTime();
  }

  private checkTime(): void {
    const s = this.settings();
    if (!s.enabled) return;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const dayOfWeek = String(now.getDay()); // 0 = Pazar, 1 = Pzt, ...

    // Check if today is selected
    if (s.days && s.days.length > 0 && !s.days.includes(dayOfWeek)) {
      return;
    }

    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;

    if (currentTimeStr === s.reminderTime) {
      const storageKey = `odv_daily_close_notified_${todayStr}_${s.reminderTime}`;
      if (localStorage.getItem(storageKey)) {
        return; // Already notified today
      }
      localStorage.setItem(storageKey, 'true');
      this.lastNotifiedDate.set(todayStr);
      this.triggerNotification(false);
    }
  }

  private triggerNotification(isTest: boolean): void {
    const title = isTest
      ? '🔔 Test Bildirimi: Gün Sonu Kapanış Saati'
      : '⏰ Gün Sonu Kapanış Saati Geldi!';
    const message = isTest
      ? 'Gün sonu hatırlatıcı sisteminiz sorunsuz çalışıyor. Belirlediğiniz saatte bu bildirim gösterilecektir.'
      : 'Bugünün kasa sayımını, nakit mutabakatını ve banka POS gün sonu sliplerini tamamlamak için tıklayınız.';

    this.alertService.warning(`${title} ${message}`);

    // If browser supports native Web Notifications and permitted
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body: message,
          icon: '/favicon.ico',
        });
        notif.onclick = () => {
          window.focus();
          this.router.navigate(['/admin/accounting'], { queryParams: { openClose: 'true' } });
        };
      } catch {
        // Ignore fallback
      }
    }
  }
}

