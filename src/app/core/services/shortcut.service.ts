import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import {
  DEFAULT_USER_SHORTCUTS,
  SHORTCUT_COLOR_THEMES,
  UserShortcut,
  AvailablePageOption,
} from '../models/shortcut.model';
import { AlertService } from './alert.service';

const STORAGE_PREFIX = 'odivon_shortcuts_v1_';

export const SYSTEM_AVAILABLE_PAGES: AvailablePageOption[] = [
  { title: 'Genel Bakış & KPI', link: '/admin/overview', icon: 'space_dashboard', category: 'Genel', defaultColor: 'indigo' },
  { title: 'Sporcu Üyeler', link: '/admin/members', icon: 'groups', category: 'Kulüp & Üyeler', defaultColor: 'indigo' },
  { title: 'Program Talepleri', link: '/admin/program-requests', icon: 'fitness_center', category: 'Kulüp & Üyeler', defaultColor: 'purple' },
  { title: 'Abonelik & Yenileme', link: '/admin/subscriptions', icon: 'card_membership', category: 'Kulüp & Üyeler', defaultColor: 'emerald' },
  { title: 'Misafir Ziyaretçiler', link: '/admin/guest-members', icon: 'person_search', category: 'Kulüp & Üyeler', defaultColor: 'amber' },
  { title: 'Ders Programı', link: '/classes', icon: 'calendar_month', category: 'Ders & Seans', defaultColor: 'cyan' },
  { title: 'PT Randevuları', link: '/appointments', icon: 'event_available', category: 'Ders & Seans', defaultColor: 'purple' },
  { title: 'Hızlı Kasa & POS', link: '/admin/shop', icon: 'shopping_cart_checkout', category: 'Kasa & Satış', defaultColor: 'emerald' },
  { title: 'Üyelik Paketleri', link: '/admin/packages', icon: 'sell', category: 'Kasa & Satış', defaultColor: 'indigo' },
  { title: 'Satış Geçmişi', link: '/admin/sales', icon: 'shopping_bag', category: 'Kasa & Satış', defaultColor: 'cyan' },
  { title: 'Terk / Çıkış Ödemeleri', link: '/admin/exit-payments', icon: 'hourglass_top', category: 'Kasa & Satış', defaultColor: 'rose' },
  { title: 'Kampanyalar & İndirimler', link: '/admin/campaigns', icon: 'campaign', category: 'Kasa & Satış', defaultColor: 'amber' },
  { title: 'Ürün & Stok Yönetimi', link: '/admin/products', icon: 'inventory_2', category: 'Envanter', defaultColor: 'cyan' },
  { title: 'Stok Sayım & Sipariş', link: '/admin/stock', icon: 'fact_check', category: 'Envanter', defaultColor: 'emerald' },
  { title: 'Tedarikçi Firmalar', link: '/admin/suppliers', icon: 'local_shipping', category: 'Envanter', defaultColor: 'indigo' },
  { title: 'Kasa & Muhasebe', link: '/admin/accounting', icon: 'account_balance', category: 'Finans', defaultColor: 'emerald' },
  { title: 'E-Fatura & E-Arşiv', link: '/admin/e-invoice', icon: 'receipt_long', category: 'Finans', defaultColor: 'purple' },
  { title: 'Alacak & Taksit Takibi', link: '/admin/receivables', icon: 'event_repeat', category: 'Finans', defaultColor: 'rose' },
  { title: 'Otomatik Hatırlatmalar', link: '/admin/reminders', icon: 'notifications_active', category: 'Finans', defaultColor: 'amber' },
  { title: 'Turnike & Geçiş Kontrol', link: '/admin/access-control', icon: 'nfc', category: 'Donanım', defaultColor: 'indigo' },
  { title: 'Personel Yönetimi', link: '/admin/staff', icon: 'badge', category: 'Yönetim', defaultColor: 'purple' },
  { title: 'Şube Yönetimi', link: '/admin/branches', icon: 'store', category: 'Yönetim', defaultColor: 'indigo' },
  { title: 'Raporlar & Analizler', link: '/admin/reports', icon: 'insights', category: 'Raporlar', defaultColor: 'cyan' },
  { title: 'İşlem Günlüğü (Audit Log)', link: '/admin/audit-log', icon: 'history', category: 'Raporlar', defaultColor: 'slate' },
];

@Injectable({ providedIn: 'root' })
export class ShortcutService {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly alert = inject(AlertService);

  readonly shortcuts = signal<UserShortcut[]>([]);
  readonly drawerOpen = signal<boolean>(false);
  readonly availablePages = signal<AvailablePageOption[]>(SYSTEM_AVAILABLE_PAGES);

  readonly colorThemes = SHORTCUT_COLOR_THEMES;

  readonly count = computed(() => this.shortcuts().length);

  constructor() {
    this.loadShortcuts();
    this.initKeyboardListener();
  }

  private get storageKey(): string {
    const tenantId = this.auth.tenantId() || 'default';
    const userId = this.auth.currentUser()?.uid || 'user';
    return `${STORAGE_PREFIX}${tenantId}_${userId}`;
  }

  loadShortcuts(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.shortcuts.set(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn('Could not read shortcuts from localStorage', e);
    }
    // Fallback defaults
    this.shortcuts.set([...DEFAULT_USER_SHORTCUTS]);
    this.saveShortcuts();
  }

  saveShortcuts(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.shortcuts()));
    } catch (e) {
      console.warn('Could not save shortcuts to localStorage', e);
    }
  }

  openDrawer(): void {
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  isPinned(link: string): boolean {
    const clean = link.split('?')[0].split('#')[0];
    return this.shortcuts().some((s) => s.link === clean);
  }

  addShortcut(item: {
    title: string;
    link: string;
    icon: string;
    color: UserShortcut['color'];
    hotkey?: string;
  }): boolean {
    const list = [...this.shortcuts()];
    if (list.length >= 10) {
      this.alert.toastError('En fazla 10 adet hızlı kısayol ekleyebilirsiniz.');
      return false;
    }

    const cleanLink = item.link.trim();
    if (list.some((s) => s.link === cleanLink)) {
      this.alert.toastInfo('Bu sayfa zaten kısayollarınızda mevcut.');
      return false;
    }

    const nextOrder = list.length;
    const hotkey = item.hotkey || (nextOrder < 9 ? `Alt+${nextOrder + 1}` : undefined);

    const newShortcut: UserShortcut = {
      id: `sc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: item.title.trim(),
      link: cleanLink,
      icon: item.icon || 'star',
      color: item.color || 'indigo',
      hotkey,
      order: nextOrder,
    };

    list.push(newShortcut);
    this.shortcuts.set(list);
    this.saveShortcuts();
    this.alert.toastSuccess(`"${item.title}" kısayollara eklendi.`);
    return true;
  }

  updateShortcut(id: string, partial: Partial<UserShortcut>): void {
    const list = this.shortcuts().map((s) => (s.id === id ? { ...s, ...partial } : s));
    this.shortcuts.set(list);
    this.saveShortcuts();
    this.alert.toastSuccess('Kısayol güncellendi.');
  }

  removeShortcut(id: string): void {
    const current = this.shortcuts().find((s) => s.id === id);
    const list = this.shortcuts()
      .filter((s) => s.id !== id)
      .map((s, idx) => ({
        ...s,
        order: idx,
        hotkey: idx < 9 ? `Alt+${idx + 1}` : undefined,
      }));
    this.shortcuts.set(list);
    this.saveShortcuts();
    if (current) {
      this.alert.toastInfo(`"${current.title}" kısayollardan kaldırıldı.`);
    }
  }

  moveShortcut(index: number, direction: 'up' | 'down'): void {
    const list = [...this.shortcuts()];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    const reordered = list.map((s, idx) => ({
      ...s,
      order: idx,
      hotkey: idx < 9 ? `Alt+${idx + 1}` : undefined,
    }));

    this.shortcuts.set(reordered);
    this.saveShortcuts();
  }

  resetToDefaults(): void {
    this.shortcuts.set([...DEFAULT_USER_SHORTCUTS]);
    this.saveShortcuts();
    this.alert.toastSuccess('Kısayollar varsayılana sıfırlandı.');
  }

  togglePinCurrent(page: AvailablePageOption): void {
    if (this.isPinned(page.link)) {
      const found = this.shortcuts().find((s) => s.link === page.link);
      if (found) this.removeShortcut(found.id);
    } else {
      this.addShortcut({
        title: page.title,
        link: page.link,
        icon: page.icon,
        color: page.defaultColor || 'indigo',
      });
    }
  }

  private initKeyboardListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Input veya textarea içerisindeyken tetikleme
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      // Alt+1 ... Alt+9 tuş kombinasyonunu yakala
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= 9) {
          const shortcut = this.shortcuts()[num - 1];
          if (shortcut) {
            e.preventDefault();
            this.router.navigateByUrl(shortcut.link);
            this.alert.toastInfo(`Kısayol (${shortcut.hotkey}): ${shortcut.title}`);
          }
        }
      }
    });
  }
}
