import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

export type GuideCategory =
  | 'quickstart'
  | 'overview'
  | 'members'
  | 'subscriptions'
  | 'packages'
  | 'accounting'
  | 'receivables'
  | 'pos'
  | 'products'
  | 'stock'
  | 'suppliers'
  | 'staff'
  | 'access-control'
  | 'e-invoice'
  | 'campaigns'
  | 'reports'
  | 'reminders'
  | 'branches'
  | 'wizard'
  | 'faq';

export interface GuideStep {
  title: string;
  description: string;
  tip?: string;
}

export interface GuideTopic {
  id: string;
  category: GuideCategory;
  title: string;
  badge?: string;
  summary: string;
  steps: GuideStep[];
  actionLink?: {
    label: string;
    route: string;
    icon: string;
  };
}

@Injectable({ providedIn: 'root' })
export class GuideService {
  private readonly router = inject(Router);

  readonly isOpen = signal(false);
  readonly activeCategory = signal<GuideCategory>('quickstart');
  readonly searchQuery = signal('');

  /**
   * Kılavuzu açar. Kategori belirtilmemişse mevcut URL yolundan
   * ilgili ekranı otomatik olarak tespit edip o sekmeyi öne çıkarır.
   */
  open(category?: GuideCategory): void {
    if (category) {
      this.activeCategory.set(category);
    } else {
      this.activeCategory.set(this.detectCategoryFromRoute());
    }
    this.searchQuery.set('');
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  selectCategory(category: GuideCategory): void {
    this.activeCategory.set(category);
  }

  private detectCategoryFromRoute(): GuideCategory {
    const url = this.router.url.toLowerCase();
    if (url.includes('/admin/members')) return 'members';
    if (url.includes('/admin/accounting')) return 'accounting';
    if (url.includes('/admin/receivables')) return 'receivables';
    if (url.includes('/admin/packages')) return 'packages';
    if (url.includes('/admin/subscriptions')) return 'subscriptions';
    if (url.includes('/admin/pos') || url.includes('/admin/shop')) return 'pos';
    if (url.includes('/admin/products')) return 'products';
    if (url.includes('/admin/stock') || url.includes('/admin/stock-categories')) return 'stock';
    if (url.includes('/admin/suppliers')) return 'suppliers';
    if (url.includes('/admin/staff')) return 'staff';
    if (url.includes('/admin/access-control')) return 'access-control';
    if (url.includes('/admin/e-invoice')) return 'e-invoice';
    if (url.includes('/admin/campaigns')) return 'campaigns';
    if (url.includes('/admin/reports')) return 'reports';
    if (url.includes('/admin/reminders')) return 'reminders';
    if (url.includes('/admin/branches')) return 'branches';
    if (url.includes('/admin/wizard') || url.includes('/admin/program-requests')) return 'wizard';
    if (url.includes('/admin/overview')) return 'overview';
    return 'quickstart';
  }
}
