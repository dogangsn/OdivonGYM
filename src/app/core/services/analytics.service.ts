import { Injectable, effect, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { CookieService } from './cookie.service';

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly router = inject(Router);
  private readonly cookieService = inject(CookieService);

  private scriptLoaded = false;
  private readonly measurementId = environment.analytics?.measurementId || '';
  private readonly isEnabled = !!environment.analytics?.enabled;

  constructor() {
    // Çerez tercihini reaktif olarak dinle (Signals Effect)
    effect(() => {
      const allowed = this.cookieService.analyticsAllowed();
      if (allowed && this.isEnabled && !this.scriptLoaded) {
        this.initializeGa();
      }
    });

    this.listenToRouterEvents();
  }

  /** Google Analytics 4 Script'ini dinamik ve güvenli olarak DOM'a ekler */
  private initializeGa(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!this.measurementId) return;

    try {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer?.push(arguments);
      };

      window.gtag('js', new Date());
      window.gtag('config', this.measurementId, {
        send_page_view: false, // SPA için sayfa görüntülemelerini Router ile manuel tetikleyeceğiz
        anonymize_ip: true,    // KVKK ve GDPR gereği IP anonimleştirme
      });

      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`;
      script.id = 'ga4-gtag-script';
      document.head.appendChild(script);

      this.scriptLoaded = true;
    } catch (err) {
      console.warn('OdivonGYM: Analytics başlatılamadı', err);
    }
  }

  /** Router sayfa geçişlerini dinleyerek page_view event'i gönderir */
  private listenToRouterEvents(): void {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.trackPageView(event.urlAfterRedirects);
      });
  }

  /** Sayfa görüntüleme takibi */
  trackPageView(url: string, title?: string): void {
    if (!this.canTrack()) return;

    window.gtag?.('event', 'page_view', {
      page_path: url,
      page_title: title || (typeof document !== 'undefined' ? document.title : ''),
      page_location: typeof window !== 'undefined' ? window.location.href : '',
    });
  }

  /** Özel analitik etkinlik takibi (CTA tıklamaları, kayıt adımları, form gönderimleri vb.) */
  trackEvent(eventName: string, params: Record<string, any> = {}): void {
    if (!this.canTrack()) return;

    window.gtag?.('event', eventName, {
      ...params,
      timestamp: new Date().toISOString(),
    });
  }

  /** Takip yapılabilir mi kontrolü: Kullanıcı izni + ortam desteği + script varlığı */
  private canTrack(): boolean {
    if (typeof window === 'undefined') return false;
    return this.isEnabled && this.cookieService.analyticsAllowed() && typeof window.gtag === 'function';
  }
}
