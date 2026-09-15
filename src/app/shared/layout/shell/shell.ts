import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { Sidebar } from '../sidebar/sidebar';

/**
 * Masaüstü öncelikli uygulama kabuğu: sabit (daraltılabilir) sol sidebar +
 * üstte sabit toolbar (arama/bildirim/tema) + içerik alanı. Dar ekranlarda
 * sidebar bir overlay drawer'a dönüşür (bkz. sidebar.scss), toolbar'daki
 * arama gizlenir — ama alt yapı (routing, guard'lar, sidebar) aynı kalır,
 * sadece CSS ile responsive olur.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, MatIconModule, MatTooltipModule, Sidebar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

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

  async logOut(): Promise<void> {
    await this.auth.logOut();
    // signOut() sadece AuthService'in signal'lerini günceller — router
    // hiçbir zaman kendiliğinden yeniden yönlendirmez (guard'lar sadece
    // NAVİGASYON anında çalışır). Aksi halde kullanıcı aynı korumalı
    // sayfada "çıkış yapmadı" hissiyle kalır.
    await this.router.navigateByUrl('/auth/login');
  }
}
