import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/services/theme.service';
import { LanguageService } from './core/i18n/language.service';
import { HttpLoadingService } from './core/services/http-loading.service';
import { LoadingStage } from './shared/components/loading-stage/loading-stage';
import { UpdateBanner } from './shared/components/update-banner/update-banner';
import { CookieConsentBanner } from './shared/components/cookie-consent-banner/cookie-consent-banner';
import { VersionService } from './core/version/version.service';
import { SeoService } from './core/services/seo.service';
import { AnalyticsService } from './core/services/analytics.service';
import { AppLockService } from './core/services/app-lock.service';
import { AppLockScreen } from './shared/components/app-lock-screen/app-lock-screen';
import { AppLockSetupModal } from './shared/components/app-lock-setup-modal/app-lock-setup-modal';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LoadingStage, UpdateBanner, CookieConsentBanner, AppLockScreen, AppLockSetupModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly httpLoading = inject(HttpLoadingService);
  protected readonly lockService = inject(AppLockService);

  // Tema, Dil, Sürüm ve SEO servisleri kök bileşende erkenden başlatılır.
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);
  private readonly version = inject(VersionService);
  private readonly seo = inject(SeoService);
  // Çerez onayına duyarlı GA4 Analitik servisi
  private readonly analytics = inject(AnalyticsService);

  /** Uygulama bir kez hazır olduktan sonra açılış yerine "Oturum açılıyor" metni gösterilir. */
  protected readonly booted = signal(false);

  constructor() {
    effect(() => {
      if (this.auth.ready()) this.booted.set(true);
    });
    this.version.start();
    this.seo.init();
  }
}
