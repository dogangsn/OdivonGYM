import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/services/theme.service';
import { LanguageService } from './core/i18n/language.service';
import { HttpLoadingService } from './core/services/http-loading.service';
import { GymLoader } from './shared/components/gym-loader/gym-loader';
import { UpdateBanner } from './shared/components/update-banner/update-banner';
import { CookieConsentBanner } from './shared/components/cookie-consent-banner/cookie-consent-banner';
import { VersionService } from './core/version/version.service';
import { SeoService } from './core/services/seo.service';
import { AnalyticsService } from './core/services/analytics.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, GymLoader, UpdateBanner, CookieConsentBanner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly httpLoading = inject(HttpLoadingService);

  // Tema, Dil, Sürüm ve SEO servisleri kök bileşende erkenden başlatılır.
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);
  private readonly version = inject(VersionService);
  private readonly seo = inject(SeoService);
  // Çerez onayına duyarlı GA4 Analitik servisi
  private readonly analytics = inject(AnalyticsService);

  constructor() {
    this.version.start();
    this.seo.init();
  }
}
