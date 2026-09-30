import { Injectable, signal } from '@angular/core';

const GYM_MOTIVATION_QUOTES = [
  'Veriler yükleniyor…',
  'Ağırlıklar ayarlanıyor…',
  'Antrenman kayıtları getiriliyor…',
  'Salon istatistikleri hesaplanıyor…',
  'Kas hafızası tazeleniyor…',
  'Son tekrarlar yapılıyor…',
  'Beslenme ve program verileri derleniyor…',
];

@Injectable({ providedIn: 'root' })
export class HttpLoadingService {
  private activeCount = 0;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private minDisplayTimer: ReturnType<typeof setTimeout> | null = null;
  private quoteInterval: ReturnType<typeof setInterval> | null = null;
  private shownAt = 0;
  private quoteIndex = 0;

  /** Global yükleme durumunu dinleyen reactive sinyal */
  readonly isLoading = signal(false);

  /** Kullanıcıya gösterilen dinamik antrenman ipucu / mesajı */
  readonly message = signal('Veriler Yükleniyor…');

  /** Bir HTTP isteği veya asenkron işlem başladığında çağrılır */
  onRequestStarted(customMsg?: string): void {
    this.activeCount++;

    if (customMsg) {
      this.message.set(customMsg);
    }

    if (this.activeCount === 1) {
      // 80ms gecikme ile çok hızlı (mikrosaniye) isteklerde ekranın anlamsızca parlamasını engelliyoruz
      this.showTimer = setTimeout(() => {
        if (this.activeCount > 0) {
          this.shownAt = Date.now();
          this.isLoading.set(true);
          this.startQuoteCycling();
        }
      }, 80);
    }
  }

  /** Bir HTTP isteği başarı veya hata ile bittiğinde çağrılır */
  onRequestFinished(): void {
    this.activeCount = Math.max(0, this.activeCount - 1);

    if (this.activeCount === 0) {
      if (this.showTimer) {
        clearTimeout(this.showTimer);
        this.showTimer = null;
      }

      if (this.isLoading()) {
        // Spor aletleri animasyonunun göze hoş görünmesi ve kullanıcıyı sarsmaması için
        // ekranda en az 400ms zarif bir şekilde durmasını garanti ediyoruz
        const elapsed = Date.now() - this.shownAt;
        const remaining = Math.max(0, 400 - elapsed);

        if (this.minDisplayTimer) {
          clearTimeout(this.minDisplayTimer);
        }

        this.minDisplayTimer = setTimeout(() => {
          if (this.activeCount === 0) {
            this.stopLoading();
          }
        }, remaining);
      } else {
        this.stopLoading();
      }
    }
  }

  private stopLoading(): void {
    this.isLoading.set(false);
    this.message.set('Veriler Yükleniyor…');
    if (this.quoteInterval) {
      clearInterval(this.quoteInterval);
      this.quoteInterval = null;
    }
    this.quoteIndex = 0;
  }

  private startQuoteCycling(): void {
    if (this.quoteInterval) {
      clearInterval(this.quoteInterval);
    }
    this.quoteIndex = 0;
    this.quoteInterval = setInterval(() => {
      this.quoteIndex = (this.quoteIndex + 1) % GYM_MOTIVATION_QUOTES.length;
      this.message.set(GYM_MOTIVATION_QUOTES[this.quoteIndex]);
    }, 2200);
  }

  /** Manuel yükleyici göstermek için (örn. dosya yükleme veya ağır hesaplama) */
  showManual(msg?: string): void {
    this.onRequestStarted(msg);
  }

  /** Manuel yükleyiciyi kapatmak için */
  hideManual(): void {
    this.onRequestFinished();
  }

  /** Acil durumlarda yükleyiciyi sıfırlamak için */
  reset(): void {
    this.activeCount = 0;
    if (this.showTimer) clearTimeout(this.showTimer);
    if (this.minDisplayTimer) clearTimeout(this.minDisplayTimer);
    this.stopLoading();
  }
}
