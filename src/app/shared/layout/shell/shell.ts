import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { LanguageService, LANGUAGE_NAMES } from '../../../core/i18n/language.service';
import { SupportedLanguage } from '../../../core/data/countries';
import { Sidebar } from '../sidebar/sidebar';

/**
 * Masaüstü öncelikli uygulama kabuğu: sabit (daraltılabilir) sol sidebar +
 * üstte sabit toolbar (arama/bildirim/tema/dil) + içerik alanı. Dar
 * ekranlarda sidebar bir overlay drawer'a dönüşür (bkz. sidebar.scss),
 * toolbar'daki arama gizlenir — ama alt yapı (routing, guard'lar, sidebar)
 * aynı kalır, sadece CSS ile responsive olur.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, MatIconModule, MatTooltipModule, MatMenuModule, Sidebar, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);
  private readonly router = inject(Router);

  protected readonly languageNames = LANGUAGE_NAMES;
  protected readonly languages = Object.keys(LANGUAGE_NAMES) as SupportedLanguage[];

  protected readonly collapsed = signal(false);
  protected readonly mobileOpen = signal(false);

  toggleCollapse(): void {
    this.collapsed.update((v) => !v);
  }

  openMobileNav(): void {
    this.mobileOpen.set(true);
  }

  closeMobileNav(): void {
    this.mobileOpen.set(false);
  }

  setLanguage(lang: SupportedLanguage): void {
    this.language.setLanguage(lang);
  }

  async logOut(): Promise<void> {
    await this.auth.logOut();
    // signOut() sadece AuthService'in signal'lerini günceller — router
    // hiçbir zaman kendiliğinden yeniden yönlendirmez (guard'lar sadece
    // NAVİGASYON anında çalışır). Aksi halde kullanıcı aynı korumalı
    // sayfada "çıkış yapmadı" hissiyle kalır.
    await this.router.navigateByUrl('/auth/login');
  }
}
