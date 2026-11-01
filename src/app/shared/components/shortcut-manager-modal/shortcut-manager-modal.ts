import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SlideOver } from '../../ui/slide-over';
import {
  ShortcutService,
  SYSTEM_AVAILABLE_PAGES,
} from '../../../core/services/shortcut.service';
import {
  AvailablePageOption,
  SHORTCUT_COLOR_THEMES,
  UserShortcut,
} from '../../../core/models/shortcut.model';

@Component({
  selector: 'app-shortcut-manager-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule, SlideOver],
  templateUrl: './shortcut-manager-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShortcutManagerModal {
  protected readonly shortcutService = inject(ShortcutService);
  private readonly router = inject(Router);

  // New shortcut form state
  protected readonly selectedPageLink = signal<string>('');
  protected readonly customTitle = signal<string>('');
  protected readonly customIcon = signal<string>('star');
  protected readonly selectedColor = signal<UserShortcut['color']>('indigo');
  protected readonly searchQuery = signal<string>('');

  protected readonly colorOptions: Array<{ id: UserShortcut['color']; label: string; bg: string }> = [
    { id: 'indigo', label: 'İndigo', bg: 'bg-indigo-500' },
    { id: 'emerald', label: 'Zümrüt', bg: 'bg-emerald-500' },
    { id: 'amber', label: 'Kehribar', bg: 'bg-amber-500' },
    { id: 'purple', label: 'Mor', bg: 'bg-purple-500' },
    { id: 'rose', label: 'Gül / Kırmızı', bg: 'bg-rose-500' },
    { id: 'cyan', label: 'Camgöbeği', bg: 'bg-cyan-500' },
  ];

  // Current active route to suggest adding
  protected readonly currentRoute = computed(() => {
    return this.router.url.split('?')[0].split('#')[0];
  });

  protected readonly currentPageObj = computed(() => {
    const url = this.currentRoute();
    return SYSTEM_AVAILABLE_PAGES.find((p) => p.link === url);
  });

  protected readonly isCurrentPagePinned = computed(() => {
    return this.shortcutService.isPinned(this.currentRoute());
  });

  // Filtered pages for the quick selector
  protected readonly filteredPages = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.shortcutService.availablePages();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.link.toLowerCase().includes(q),
    );
  });

  onPageSelect(link: string): void {
    this.selectedPageLink.set(link);
    const found = SYSTEM_AVAILABLE_PAGES.find((p) => p.link === link);
    if (found) {
      this.customTitle.set(found.title);
      this.customIcon.set(found.icon);
      this.selectedColor.set(found.defaultColor || 'indigo');
    }
  }

  addCurrentPage(): void {
    const cur = this.currentPageObj();
    if (cur) {
      this.shortcutService.addShortcut({
        title: cur.title,
        link: cur.link,
        icon: cur.icon,
        color: cur.defaultColor || 'indigo',
      });
    } else {
      const url = this.currentRoute();
      const parts = url.split('/').filter(Boolean);
      const name = parts[parts.length - 1] || 'Sayfa';
      this.shortcutService.addShortcut({
        title: name.charAt(0).toUpperCase() + name.slice(1),
        link: url,
        icon: 'bookmark',
        color: 'indigo',
      });
    }
  }

  saveNewShortcut(): void {
    const title = this.customTitle().trim();
    const link = this.selectedPageLink().trim();
    if (!title || !link) return;

    const ok = this.shortcutService.addShortcut({
      title,
      link,
      icon: this.customIcon() || 'star',
      color: this.selectedColor(),
    });

    if (ok) {
      // Reset form
      this.selectedPageLink.set('');
      this.customTitle.set('');
      this.customIcon.set('star');
      this.selectedColor.set('indigo');
    }
  }

  getColorTheme(color: UserShortcut['color']) {
    return SHORTCUT_COLOR_THEMES[color] || SHORTCUT_COLOR_THEMES.indigo;
  }
}
