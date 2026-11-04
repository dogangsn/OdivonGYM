import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { visiblePolling } from '../api/unwrap';
import { PlatformNotification, PlatformNotificationsApi } from '../api/platform-notifications.api';
import { SaasBillingApi, SaasNotice } from '../api/saas-billing.api';
import { AuthService } from '../auth/auth.service';
import { PermissionService } from './permission.service';
import { AlertService } from './alert.service';

export interface AppNotification {
  id: string;
  titleKey: string;
  messageKey: string;
  title?: string;
  message?: string;
  time: string;
  type: 'warning' | 'info' | 'success';
  icon: string;
  read: boolean;
  link?: string;
  linkLabel?: string;
  source: 'saas' | 'platform';
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionService);
  private readonly platformNotices = inject(PlatformNotificationsApi);
  private readonly saasBilling = inject(SaasBillingApi);
  private readonly alert = inject(AlertService);

  readonly notifications = signal<AppNotification[]>([]);
  readonly loading = signal<boolean>(false);
  readonly unreadCount = computed(() => this.notifications().filter((n) => !n.read).length);

  private readonly noticeContext = computed(() => ({
    tenantId: this.auth.profile()?.tenantId ?? null,
    staff: this.permissions.isStaff(),
    admin: this.permissions.isAdmin(),
  }));

  constructor() {
    toObservable(this.noticeContext)
      .pipe(
        switchMap((ctx) =>
          !ctx.tenantId || !ctx.staff
            ? of([] as AppNotification[])
            : visiblePolling(2 * 60_000).pipe(
                startWith(0),
                switchMap(() => this.loadNotices(ctx.admin)),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((list) => this.notifications.set(list));
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await firstValueFrom(this.loadNotices(this.permissions.isAdmin()));
      this.notifications.set(list);
    } finally {
      this.loading.set(false);
    }
  }

  private loadNotices(admin: boolean) {
    const fmt = (iso: string) => {
      try {
        return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
      } catch {
        return '—';
      }
    };

    return forkJoin({
      platform: this.platformNotices.list(100).pipe(catchError(() => of([] as PlatformNotification[]))),
      saas: admin ? this.saasBilling.notices().pipe(catchError(() => of([] as SaasNotice[]))) : of([] as SaasNotice[]),
    }).pipe(
      map(({ platform, saas }) => {
        const fromPlatform: AppNotification[] = platform.map((n) => ({
          id: n.id,
          titleKey: '',
          messageKey: '',
          title: n.title,
          message: n.body,
          time: fmt(n.createdAt),
          type: n.level === 'warning' || n.level === 'critical' ? 'warning' : n.level === 'success' ? 'success' : 'info',
          icon: n.level === 'critical' ? 'priority_high' : n.level === 'warning' ? 'warning' : 'campaign',
          read: n.read,
          link: n.link ?? undefined,
          linkLabel: n.linkLabel ?? undefined,
          source: 'platform',
          createdAt: n.createdAt,
        }));

        const fromSaas: AppNotification[] = saas.map((n) => ({
          id: n.id,
          titleKey: '',
          messageKey: '',
          title: n.title,
          message: n.body,
          time: fmt(n.createdAt),
          type: n.type === 'saas_grace' || n.daysLeft <= 1 ? 'warning' : 'info',
          icon: 'event_busy',
          read: Boolean(n.readAt),
          link: '/admin/subscription',
          linkLabel: 'Aboneliği İncele',
          source: 'saas',
          createdAt: n.createdAt,
        }));

        return [...fromPlatform, ...fromSaas].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }),
    );
  }

  async markAsRead(item: AppNotification): Promise<void> {
    if (item.read) return;
    this.notifications.update((list) => list.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    try {
      if (item.source === 'platform') {
        await firstValueFrom(this.platformNotices.markRead(item.id));
      } else {
        await firstValueFrom(this.saasBilling.readNotices());
      }
    } catch {
      // sessiz hata
    }
  }

  async markAllAsRead(): Promise<void> {
    const list = this.notifications();
    this.notifications.update((items) => items.map((n) => ({ ...n, read: true })));
    try {
      const promises: Promise<unknown>[] = [];
      if (list.some((n) => n.source === 'platform' && !n.read)) {
        promises.push(firstValueFrom(this.platformNotices.markAllRead()));
      }
      if (list.some((n) => n.source === 'saas' && !n.read)) {
        promises.push(firstValueFrom(this.saasBilling.readNotices()));
      }
      await Promise.all(promises);
      this.alert.toastSuccess('Tüm bildirimler okundu olarak işaretlendi.');
    } catch {
      this.alert.toastError('İşlem sırasında hata oluştu.');
    }
  }

  async deleteNotification(item: AppNotification): Promise<void> {
    this.notifications.update((list) => list.filter((n) => n.id !== item.id));
    try {
      if (item.source === 'platform') {
        await firstValueFrom(this.platformNotices.remove(item.id));
      } else {
        await firstValueFrom(this.saasBilling.removeNotice(item.id));
      }
      this.alert.toastSuccess('Bildirim silindi.');
    } catch {
      this.alert.toastError('Bildirim silinemedi.');
    }
  }

  async clearAllRead(): Promise<void> {
    const readItems = this.notifications().filter((n) => n.read);
    if (readItems.length === 0) {
      this.alert.toastInfo('Silinecek okunmuş bildirim bulunmuyor.');
      return;
    }

    const confirmed = await this.alert.actionConfirm(
      'Okunmuş Bildirimleri Temizle',
      `Toplam <b>${readItems.length}</b> adet okunmuş bildirim kalıcı olarak silinecektir. Devam etmek istiyor musunuz?`,
      'Evet, Temizle',
      'warning',
    );
    if (!confirmed) return;

    this.notifications.update((list) => list.filter((n) => !n.read));
    try {
      const promises: Promise<unknown>[] = [];
      if (readItems.some((n) => n.source === 'platform')) {
        promises.push(firstValueFrom(this.platformNotices.clearRead()));
      }
      if (readItems.some((n) => n.source === 'saas')) {
        promises.push(firstValueFrom(this.saasBilling.clearReadNotices()));
      }
      await Promise.all(promises);
      this.alert.toastSuccess('Okunmuş bildirimler temizlendi.');
    } catch {
      this.alert.toastError('Temizleme işlemi tamamlanamadı.');
    }
  }
}

