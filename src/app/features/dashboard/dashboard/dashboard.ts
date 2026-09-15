import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth/auth.service';

interface StatCard {
  icon: string;
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly snackBar = inject(MatSnackBar);
  protected readonly auth = inject(AuthService);

  protected readonly firstName = computed(() => this.auth.profile()?.displayName?.split(' ')[0] ?? 'Üye');

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 6) return 'İyi geceler';
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'İyi günler';
    return 'İyi akşamlar';
  });

  protected readonly statCards = computed<StatCard[]>(() => [
    {
      icon: 'bolt',
      label: this.auth.membershipStatus() === 'active' ? 'Üyelik' : 'Kalan Deneme',
      value: `${this.auth.trialDaysLeft()} gün`,
      hint: this.auth.membershipStatus() === 'active' ? 'Üyeliğin aktif' : 'Ücretsiz deneme',
      highlight: true,
    },
    {
      icon: 'account_balance_wallet',
      label: 'E-Cüzdan Bakiyesi',
      value: `₺${(this.auth.profile()?.walletBalance ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      hint: 'Otomat ve market alışverişi',
    },
    {
      icon: 'verified_user',
      label: 'Üyelik Durumu',
      value: this.auth.membershipStatus() === 'active' ? 'Aktif' : 'Deneme',
      hint: 'Paketler sayfasından yükselt',
    },
    {
      icon: 'fitness_center',
      label: 'Bugünkü Antrenman',
      value: 'Planlanmadı',
      hint: 'Program yakında aktif olacak',
    },
    {
      icon: 'event',
      label: 'Sıradaki Randevu',
      value: 'Randevu yok',
      hint: 'PT randevu yakında aktif olacak',
    },
  ]);

  protected readonly upcomingCards = [
    { icon: 'qr_code_2', title: 'QR ile Giriş', desc: 'Turnikeden geçiş için dinamik QR kod' },
    { icon: 'account_balance_wallet', title: 'E-Cüzdan', desc: 'Bakiye yükle, işlem geçmişini gör', link: '/wallet' },
    { icon: 'calendar_month', title: 'Ders Takvimi', desc: 'Grup derslerine rezervasyon yap', link: '/classes' },
    {
      icon: 'sports_gymnastics',
      title: 'Antrenman Programı',
      desc: 'Kişisel programını görüntüle',
      link: '/workout',
    },
    { icon: 'event_available', title: 'PT Randevu', desc: 'Personal trainer randevusu al', link: '/appointments' },
    { icon: 'water_drop', title: 'Su Takibi', desc: 'Günlük su hedefini takip et', link: '/water' },
    {
      icon: 'monitor_weight',
      title: 'Vücut Ölçümleri',
      desc: 'Kilo ve yağ oranı geçmişin',
      link: '/measurements',
    },
  ];

  notifyComingSoon(title: string): void {
    this.snackBar.open(`${title} yakında burada olacak! 🚧`, 'Kapat', { duration: 2500 });
  }
}
