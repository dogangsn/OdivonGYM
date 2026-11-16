import { Injectable, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { CookieService } from './cookie.service';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

/** GA4 ölçüm kimliği biçimi: G- ve ardından büyük harf/rakam. */
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{6,12}$/;

/**
 * Dönüşüm olayları. GA4'te "Önemli etkinlik" (key event) olarak işaretlenecek olan
 * `sign_up`'tır; `cta_click` niyet ölçer (hangi düğmeden kayda gidildi).
 */
export type AnalyticsEvent =
  | 'cta_click' // Tanıtım sayfasında "Demo Hesap Oluştur" / "Giriş Yap" tıklaması
  | 'sign_up' // Demo (14 gün deneme) hesabı başarıyla oluşturuldu
  | 'login'; // Başarılı giriş

/**
 * Google Analytics 4. Betik yalnızca ölçüm kimliği geçerliyse ve kullanıcı çerez
 * bildiriminde Analitik çerezlere izin verdiyse yüklenir (KVKK). İzin sonradan geri
 * alınırsa ölçüm durdurulur. Adreslerden sorgu dizesi ve # kısmı atılır; ödeme
 * dönüşlerindeki jetonlar, e-posta doğrulama kodları GA'ya gitmez.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly router = inject(Router);
  private readonly cookieService = inject(CookieService);
  private readonly document = inject(DOCUMENT);

  private readonly measurementId = (environment.analytics?.measurementId || '').trim();
  private readonly isEnabled =
    !!environment.analytics?.enabled && MEASUREMENT_ID_PATTERN.test(this.measurementId);

  private scriptLoaded = false;

  constructor() {
    effect(() => {
      const allowed = this.cookieService.analyticsAllowed();
      if (!this.isEnabled) return;
      if (allowed) {
        window[`ga-disable-${this.measurementId}`] = false;
        if (!this.scriptLoaded) {
          this.initializeGa();
        } else {
          window.gtag?.('consent', 'update', { analytics_storage: 'granted' });
        }
      } else if (this.scriptLoaded) {
        window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
        window[`ga-disable-${this.measurementId}`] = true;
      }
    });

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.trackPageView(event.urlAfterRedirects));
  }

  private initializeGa(): void {
    try {
      window.dataLayer = window.dataLayer || [];
      // gtag.js "arguments" nesnesini bekler; dizi verilirse komutlar işlenmez.
      window.gtag = function () {
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer?.push(arguments);
      };

      // Reklam çerezleri kapalı; yalnızca analitik ölçüm (izin verildiği için).
      window.gtag('consent', 'default', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'granted',
      });
      window.gtag('js', new Date());
      window.gtag('config', this.measurementId, {
        send_page_view: false, // SPA: sayfa görüntülemeyi Router ile biz gönderiyoruz
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });

      const script = this.document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`;
      script.id = 'ga4-gtag-script';
      this.document.head.appendChild(script);

      this.scriptLoaded = true;
      // İzin, sayfa açıldıktan sonra verildiyse o anki sayfayı da say.
      this.trackPageView(this.router.url);
    } catch (err) {
      console.warn('OdivonGYM: Analytics başlatılamadı', err);
    }
  }

  trackPageView(url: string): void {
    if (!this.canTrack()) return;
    const path = AnalyticsService.cleanPath(url);
    window.gtag?.('event', 'page_view', {
      page_path: path,
      page_location: `${window.location.origin}${path}`,
      page_title: this.document.title,
    });
  }

  /** Dönüşüm ve etkileşim olayı. Parametrelere kişisel veri (e-posta, ad, telefon) koymayın. */
  trackEvent(eventName: AnalyticsEvent, params: Record<string, string | number | boolean> = {}): void {
    if (!this.canTrack()) return;
    window.gtag?.('event', eventName, params);
  }

  /** Sorgu dizesi ve # kısmını atar; panel içindeki kimlikleri (/admin/members/<id>) maskeler. */
  static cleanPath(url: string): string {
    const path = (url || '/').split(/[?#]/)[0] || '/';
    return path
      .split('/')
      .map((segment) => (segment.length >= 16 && /\d/.test(segment) ? ':id' : segment))
      .join('/');
  }

  private canTrack(): boolean {
    return (
      this.isEnabled &&
      this.scriptLoaded &&
      this.cookieService.analyticsAllowed() &&
      typeof window.gtag === 'function'
    );
  }
}
