import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { AppNotification, NotificationCenterService } from '../../core/services/notification-center.service';
import { AlertService } from '../../core/services/alert.service';

type FilterType = 'all' | 'unread' | 'read' | 'platform' | 'saas';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans space-y-6">
      <!-- SAYFA BAŞLIĞI & HIZLI İŞLEMLER -->
      <app-page-header
        title="Bildirim Merkezi & Olay Geçmişi"
        icon="notifications"
        description="Odivon sistem duyuruları, abonelik bildirimleri ve işletme uyarılarını tek bir ekrandan inceleyin ve yönetin."
      >
        <div actions class="flex items-center gap-2 flex-wrap">
          @if (unreadCount() > 0) {
            <button
              type="button"
              class="odv-btn-soft flex items-center gap-1.5 cursor-pointer"
              (click)="markAllAsRead()"
            >
              <mat-icon class="icon-size-4">done_all</mat-icon>
              <span>Tümünü Okundu Say ({{ unreadCount() }})</span>
            </button>
          }

          @if (readCount() > 0) {
            <button
              type="button"
              class="odv-btn-ghost text-rose-600 dark:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 flex items-center gap-1.5 cursor-pointer"
              (click)="clearAllRead()"
            >
              <mat-icon class="icon-size-4">delete_sweep</mat-icon>
              <span>Okunmuşları Temizle ({{ readCount() }})</span>
            </button>
          }

          <button
            type="button"
            class="odv-icon-btn cursor-pointer"
            (click)="refresh()"
            title="Yenile"
          >
            <mat-icon class="icon-size-4" [class.animate-spin]="loading()">refresh</mat-icon>
          </button>
        </div>
      </app-page-header>

      <!-- KPI METRİK KARTLARI -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- KPI 1: Toplam Bildirim (Gradient Hero) -->
        <div class="p-5 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/20 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold uppercase tracking-wider text-white/80">Toplam Bildirim</span>
              <div class="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center backdrop-blur-xs">
                <mat-icon class="icon-size-4.5">notifications</mat-icon>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {{ totalCount() }}
              </div>
              <div class="text-xs font-semibold text-white/80 mt-1">
                Kayıtlı bildirim geçmişi
              </div>
            </div>
          </div>
        </div>

        <!-- KPI 2: Okunmamış Bildirimler (Amber Accent) -->
        <div class="odv-card p-5 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Bekleyen Okunmamış</span>
              <div class="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <mat-icon class="icon-size-4.5">mark_email_unread</mat-icon>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>{{ unreadCount() }}</span>
                @if (unreadCount() > 0) {
                  <span class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                }
              </div>
              <div class="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1">
                İnceleme bekleyen bildirim
              </div>
            </div>
          </div>
        </div>

        <!-- KPI 3: Odivon Duyuruları -->
        <div class="odv-card p-5 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold uppercase tracking-wider text-indigo-500">Odivon Duyuruları</span>
              <div class="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <mat-icon class="icon-size-4.5">campaign</mat-icon>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {{ platformCount() }}
              </div>
              <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                İşletme & sistem bildirimleri
              </div>
            </div>
          </div>
        </div>

        <!-- KPI 4: Abonelik & Lisans Hatırlatmaları -->
        <div class="odv-card p-5 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold uppercase tracking-wider text-sky-500">Abonelik & Lisans</span>
              <div class="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <mat-icon class="icon-size-4.5">card_membership</mat-icon>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {{ saasCount() }}
              </div>
              <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                Paket yenileme hatırlatmaları
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- FİLTRE & ARAMA ÇUBUĞU -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <!-- Segmented Tab Butonları -->
        <div class="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs font-bold overflow-x-auto">
          <button
            type="button"
            (click)="filter.set('all')"
            class="px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            [class.bg-white]="filter() === 'all'"
            [class.dark:bg-slate-700]="filter() === 'all'"
            [class.text-indigo-600]="filter() === 'all'"
            [class.dark:text-indigo-400]="filter() === 'all'"
            [class.shadow-2xs]="filter() === 'all'"
            [class.text-slate-600]="filter() !== 'all'"
            [class.dark:text-slate-400]="filter() !== 'all'"
          >
            <span>Tümü</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {{ totalCount() }}
            </span>
          </button>

          <button
            type="button"
            (click)="filter.set('unread')"
            class="px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            [class.bg-white]="filter() === 'unread'"
            [class.dark:bg-slate-700]="filter() === 'unread'"
            [class.text-amber-600]="filter() === 'unread'"
            [class.dark:text-amber-400]="filter() === 'unread'"
            [class.shadow-2xs]="filter() === 'unread'"
            [class.text-slate-600]="filter() !== 'unread'"
            [class.dark:text-slate-400]="filter() !== 'unread'"
          >
            <span>Okunmamış</span>
            @if (unreadCount() > 0) {
              <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
                {{ unreadCount() }}
              </span>
            }
          </button>

          <button
            type="button"
            (click)="filter.set('read')"
            class="px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            [class.bg-white]="filter() === 'read'"
            [class.dark:bg-slate-700]="filter() === 'read'"
            [class.text-indigo-600]="filter() === 'read'"
            [class.dark:text-indigo-400]="filter() === 'read'"
            [class.shadow-2xs]="filter() === 'read'"
            [class.text-slate-600]="filter() !== 'read'"
            [class.dark:text-slate-400]="filter() !== 'read'"
          >
            <span>Okunmuş</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {{ readCount() }}
            </span>
          </button>

          <button
            type="button"
            (click)="filter.set('platform')"
            class="px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            [class.bg-white]="filter() === 'platform'"
            [class.dark:bg-slate-700]="filter() === 'platform'"
            [class.text-indigo-600]="filter() === 'platform'"
            [class.dark:text-indigo-400]="filter() === 'platform'"
            [class.shadow-2xs]="filter() === 'platform'"
            [class.text-slate-600]="filter() !== 'platform'"
            [class.dark:text-slate-400]="filter() !== 'platform'"
          >
            <span>Odivon</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {{ platformCount() }}
            </span>
          </button>

          <button
            type="button"
            (click)="filter.set('saas')"
            class="px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            [class.bg-white]="filter() === 'saas'"
            [class.dark:bg-slate-700]="filter() === 'saas'"
            [class.text-sky-600]="filter() === 'saas'"
            [class.dark:text-sky-400]="filter() === 'saas'"
            [class.shadow-2xs]="filter() === 'saas'"
            [class.text-slate-600]="filter() !== 'saas'"
            [class.dark:text-slate-400]="filter() !== 'saas'"
          >
            <span>Abonelik</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {{ saasCount() }}
            </span>
          </button>
        </div>

        <!-- Arama Kutusu -->
        <div class="relative w-full sm:w-72">
          <input
            type="text"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            class="odv-input pl-9 text-xs"
            placeholder="Bildirimlerde ara…"
          />
          <mat-icon class="icon-size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">search</mat-icon>
          @if (searchQuery()) {
            <button
              type="button"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer p-0.5"
              (click)="searchQuery.set('')"
            >
              <mat-icon class="icon-size-3.5">close</mat-icon>
            </button>
          }
        </div>
      </div>

      <!-- BİLDİRİM LİSTESİ (FEED / CARD FORMAT) -->
      <div class="space-y-3">
        @if (loading()) {
          <div class="odv-card py-16 text-center text-sm text-slate-500">
            <mat-icon class="icon-size-8 text-indigo-500 animate-spin">refresh</mat-icon>
            <p class="mt-2 m-0 font-medium">Bildirimler yükleniyor…</p>
          </div>
        } @else if (filteredNotifications().length === 0) {
          <div class="odv-card py-16 text-center">
            <div class="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <mat-icon class="icon-size-8">notifications_off</mat-icon>
            </div>
            <h4 class="text-base font-bold text-slate-800 dark:text-slate-200 m-0">
              {{ searchQuery() ? 'Aramanıza uygun bildirim bulunamadı' : 'Bildirim bulunmuyor' }}
            </h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto m-0">
              {{ searchQuery() ? 'Farklı bir arama terimi deneyebilir veya filtreyi temizleyebilirsiniz.' : 'Tüm bildirimleriniz güncel ve kontrol altında.' }}
            </p>
          </div>
        } @else {
          @for (item of filteredNotifications(); track item.id) {
            <div
              class="odv-card p-4 sm:p-5 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border"
              [class.border-indigo-300]="!item.read"
              [class.dark:border-indigo-800]="!item.read"
              [class.bg-indigo-50/20]="!item.read"
              [class.dark:bg-indigo-950/10]="!item.read"
            >
              <!-- Sol Taraf: İkon & İçerik -->
              <div class="flex items-start gap-3.5 min-w-0 flex-1">
                <!-- Seviye İkonu -->
                <div
                  class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-2xs"
                  [ngClass]="{
                    'bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60': item.type === 'warning',
                    'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60': item.type === 'success',
                    'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60': item.type === 'info'
                  }"
                >
                  <mat-icon class="icon-size-5">{{ item.icon }}</mat-icon>
                </div>

                <div class="min-w-0 flex-1">
                  <!-- Üst Etiketler & Tarih -->
                  <div class="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                      [class]="item.source === 'platform' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60' : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900/60'"
                    >
                      {{ item.source === 'platform' ? 'Odivon Platform' : 'Abonelik & Lisans' }}
                    </span>

                    @if (!item.read) {
                      <span class="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/60">
                        <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        Okunmadı
                      </span>
                    }

                    <span class="text-[11px] text-slate-400 ml-auto">{{ item.time }}</span>
                  </div>

                  <!-- Başlık -->
                  <h4 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white m-0 tracking-tight" [class.font-black]="!item.read">
                    {{ item.title }}
                  </h4>

                  <!-- Mesaj İçeriği -->
                  @if (item.message) {
                    <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 mb-0 leading-relaxed">
                      {{ item.message }}
                    </p>
                  }

                  <!-- Varsa Dış/İç Bağlantı Butonu -->
                  @if (item.link) {
                    <div class="mt-2.5">
                      <button
                        type="button"
                        (click)="navigateTo(item.link)"
                        class="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline cursor-pointer bg-transparent border-none p-0"
                      >
                        <span>{{ item.linkLabel || 'Detayları İncele' }}</span>
                        <mat-icon class="icon-size-3.5">arrow_forward</mat-icon>
                      </button>
                    </div>
                  }
                </div>
              </div>

              <!-- Sağ Taraf: Aksiyon Butonları -->
              <div class="flex items-center gap-1.5 self-end sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 w-full sm:w-auto justify-end">
                @if (!item.read) {
                  <button
                    type="button"
                    (click)="markAsRead(item)"
                    class="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Okundu olarak işaretle"
                  >
                    <mat-icon class="icon-size-3.5">done</mat-icon>
                    <span>Okundu Yap</span>
                  </button>
                }

                <button
                  type="button"
                  (click)="deleteItem(item)"
                  class="odv-icon-btn odv-icon-btn-danger cursor-pointer"
                  title="Bildirimi Sil / Temizle"
                >
                  <mat-icon class="icon-size-4">delete_outline</mat-icon>
                </button>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class AdminNotifications {
  private readonly notificationCenter = inject(NotificationCenterService);
  private readonly alert = inject(AlertService);
  private readonly router = inject(Router);

  readonly filter = signal<FilterType>('all');
  readonly searchQuery = signal('');

  readonly loading = this.notificationCenter.loading;
  readonly notifications = this.notificationCenter.notifications;
  readonly unreadCount = this.notificationCenter.unreadCount;

  readonly totalCount = computed(() => this.notifications().length);
  readonly readCount = computed(() => this.notifications().filter((n) => n.read).length);
  readonly platformCount = computed(() => this.notifications().filter((n) => n.source === 'platform').length);
  readonly saasCount = computed(() => this.notifications().filter((n) => n.source === 'saas').length);

  readonly filteredNotifications = computed(() => {
    let list = this.notifications();
    const f = this.filter();
    if (f === 'unread') list = list.filter((n) => !n.read);
    else if (f === 'read') list = list.filter((n) => n.read);
    else if (f === 'platform') list = list.filter((n) => n.source === 'platform');
    else if (f === 'saas') list = list.filter((n) => n.source === 'saas');

    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(
        (n) =>
          (n.title ?? '').toLowerCase().includes(q) ||
          (n.message ?? '').toLowerCase().includes(q),
      );
    }

    return list;
  });

  refresh(): void {
    void this.notificationCenter.reload();
  }

  markAsRead(item: AppNotification): void {
    void this.notificationCenter.markAsRead(item);
  }

  markAllAsRead(): void {
    void this.notificationCenter.markAllAsRead();
  }

  async deleteItem(item: AppNotification): Promise<void> {
    const ok = await this.alert.actionConfirm(
      'Bildirimi Sil',
      `"<b>${item.title}</b>" başlıklı bildirimi silmek istediğinize emin misiniz?`,
      'Evet, Sil',
      'warning',
    );
    if (!ok) return;
    await this.notificationCenter.deleteNotification(item);
  }

  clearAllRead(): void {
    void this.notificationCenter.clearAllRead();
  }

  navigateTo(link: string): void {
    if (/^https?:\/\//i.test(link)) {
      window.open(link, '_blank', 'noopener');
    } else {
      void this.router.navigateByUrl(link);
    }
  }
}
