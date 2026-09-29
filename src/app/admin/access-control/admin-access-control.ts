import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SlideOver } from '../../shared/ui/slide-over';
import { AlertService } from '../../core/services/alert.service';
import {
  AccessAgent,
  AdminAccessControlService,
  DEVICE_PROTOCOLS,
  DeviceProtocol,
  DeviceSyncItem,
  DeviceSyncStatus,
  DeviceSyncSummary,
  GateScanResult,
  TurnstileGate,
} from './admin-access-control.service';
import { environment } from '../../../environments/environment';
import { AdminMembersService } from '../members/admin-members.service';
import { AccessDirection, AccessStatus } from '../../core/models/access-log.model';
import { AuthService } from '../../core/auth/auth.service';
import { RouterLink } from '@angular/router';
import { SaasSubscriptionService } from '../../core/services/saas-subscription.service';

@Component({
  selector: 'app-admin-access-control',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule, PageHeader, SlideOver, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans space-y-6">
      <!-- 1. Page Header -->
      <app-page-header
        title="Turnike & Geçiş Kontrol"
        icon="nfc"
        description="Turnike ve kart okuyucuları izle, geçiş kayıtlarını denetle, üye yetkilerinin cihazlara uygulanmasını takip et."
      >
        <div actions class="flex items-center gap-2">
          <button
            type="button"
            (click)="openAgentWizard()"
            class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <mat-icon class="icon-size-4">hub</mat-icon>
            <span>Edge Agent</span>
          </button>

          <button
            type="button"
            disabled
            matTooltip="Uzaktan kapı açma, cihazda güvenli ve süreli röle komutu doğrulanana kadar kapalı."
            class="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 shadow-2xs opacity-50 cursor-not-allowed"
          >
            <mat-icon class="icon-size-4">warning</mat-icon>
            <span>Acil / Tahliye Açılışı</span>
          </button>

          <button
            type="button"
            (click)="openAddGateDrawer()"
            class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <mat-icon class="icon-size-4">add</mat-icon>
            <span>Yeni Cihaz Ekle</span>
          </button>
        </div>
      </app-page-header>

      <!-- SAAS SÜRESİ DOLDU UYARISI -->
      @if (saasSub.isExpired()) {
        <div class="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/80 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-rose-600/30 border border-rose-500 flex items-center justify-center text-rose-300 shrink-0">
              <mat-icon class="text-xl">lock</mat-icon>
            </div>
            <div>
              <span class="font-extrabold text-sm block text-rose-100">Turnike Donanım Senkronizasyonu Kilitlendi</span>
              <span class="text-xs text-rose-200/80">SaaS lisans süreniz bittiği için otomatik turnike röleleri ve QR geçişleri askıya alınmıştır. Kesintisiz geçiş için paketinizi yenileyiniz.</span>
            </div>
          </div>
          <a
            routerLink="/admin/subscription"
            class="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold text-xs shadow-md transition-all whitespace-nowrap self-start sm:self-auto cursor-pointer no-underline"
          >
            Paketi Yenile ➜
          </a>
        </div>
      }

      <!-- 2. Cihaz kartları -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        @for (gate of gates(); track gate.id || gate.name) {
          <div
            class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all hover:border-indigo-400/50"
          >
            <div>
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0"
                  >
                    <mat-icon class="icon-size-5">nfc</mat-icon>
                  </div>
                  <div>
                    <h3 class="text-sm font-bold text-slate-900 dark:text-white m-0">{{ gate.name }}</h3>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 m-0">{{ gate.location }}</p>
                  </div>
                </div>

                <div class="flex items-center gap-1.5">
                  @if (!gate.agentId) {
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                      matTooltip="Bu cihaz henüz bir Edge Agent ile eşleştirilmedi."
                    >
                      Agent yok
                    </span>
                  } @else if (gate.online) {
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60"
                    >
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Çevrimiçi
                    </span>
                  } @else {
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60"
                      [matTooltip]="gate.lastError || 'Agent veya cihazdan son 30 saniyede haber alınamadı.'"
                    >
                      <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      Çevrimdışı
                    </span>
                  }
                  <button
                    type="button"
                    (click)="deleteGate(gate)"
                    matTooltip="Cihazı Sil"
                    class="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center justify-center transition-all cursor-pointer"
                  >
                    <mat-icon class="icon-size-4">delete</mat-icon>
                  </button>
                </div>
              </div>

              <!-- Protokol ve yön -->
              <div class="flex flex-wrap items-center gap-1.5 mt-3">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                  <mat-icon class="icon-size-3">settings_ethernet</mat-icon>
                  {{ protocolLabel(gate.protocol) }}
                </span>
                @if (gate.adapterStatus === 'hardware_pending') {
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                    matTooltip="Cihazın bitiş tarihini gerçekten uyguladığı donanım testinde doğrulanmadan canlı kullanıma alınmamalı."
                  >
                    Donanım testi bekliyor
                  </span>
                } @else if (gate.adapterStatus === 'not_validated') {
                  <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    Hazır değil
                  </span>
                }
                <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {{ gate.direction === 'in' ? 'Yalnızca Giriş' : gate.direction === 'out' ? 'Yalnızca Çıkış' : 'Çift Yönlü' }}
                </span>
              </div>

              <!-- Ayrıntılar -->
              <div class="grid grid-cols-2 gap-3 mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                <div>
                  <span class="text-[11px] text-slate-400 block">Yerel Adres</span>
                  <span class="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate block">
                    {{ gate.host || gate.endpoint || '—' }}{{ gate.port ? ':' + gate.port : '' }}
                  </span>
                </div>
                <div>
                  <span class="text-[11px] text-slate-400 block">Son Görülme</span>
                  <span class="font-bold text-slate-800 dark:text-slate-200 truncate block">{{ formatRelative(gate.lastSeenAt) }}</span>
                </div>
              </div>

              <!-- Üye senkronu -->
              @if (gate.capabilities?.userSync) {
                <button
                  type="button"
                  (click)="openSyncDrawer(gate)"
                  class="w-full mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300 flex items-center justify-between gap-2 text-[11px] cursor-pointer transition-all"
                  matTooltip="Üye yetkilerinin bu cihaza uygulanma durumu"
                >
                  <span class="font-bold text-slate-600 dark:text-slate-300">Üye senkronu</span>
                  <span class="flex items-center gap-2">
                    <span class="text-amber-600 dark:text-amber-400">Bekliyor <b>{{ syncCount(gate, 'pending') }}</b></span>
                    <span class="text-emerald-600 dark:text-emerald-400">Uygulandı <b>{{ syncCount(gate, 'applied') }}</b></span>
                    <span class="text-rose-600 dark:text-rose-400">Hata <b>{{ syncCount(gate, 'error') }}</b></span>
                  </span>
                </button>
              }
            </div>

            <!-- Kapı açma: yalnızca doğrulanmış yetenek varsa -->
            <div class="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <span class="text-xs text-slate-400">
                Bugün: <strong class="text-slate-700 dark:text-slate-200">{{ getGateTodayPasses(gate) }}</strong> Geçiş
              </span>
              <button
                type="button"
                disabled
                [matTooltip]="gate.capabilities?.doorOpen ? '' : 'Bu cihazda güvenli, süreli röle komutu henüz doğrulanmadı.'"
                class="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1.5 opacity-50 cursor-not-allowed"
              >
                <mat-icon class="icon-size-3.5">lock_open</mat-icon>
                <span>Kapıyı Aç</span>
              </button>
            </div>
          </div>
        } @empty {
          <div class="md:col-span-3 p-10 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 text-center">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3.5 shadow-xs">
              <mat-icon class="icon-size-7">nfc</mat-icon>
            </div>
            <h4 class="text-base font-bold text-slate-900 dark:text-white m-0">Henüz Tanımlı Cihaz Bulunmuyor</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5 mb-5 max-w-md mx-auto">
              Önce cihazı protokolü ve yerel IP adresiyle ekleyin, sonra salondaki bilgisayarda Edge Agent'ı eşleştirin.
            </p>
            <button
              type="button"
              (click)="openAddGateDrawer()"
              class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <mat-icon class="icon-size-4">add</mat-icon>
              <span>Yeni Cihaz Ekle</span>
            </button>
          </div>
        }
      </div>

      <!-- 3. Canlı Resepsiyon Kart / Barkod Okutma Çubuğu (Physical USB/Handheld Scanner Listener) -->
      <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div class="relative flex-1 w-full">
          <input
            type="text"
            placeholder="Fiziksel USB Barkod/QR Okuyucu ile Okutun veya Kart/QR Kodu Girin (Enter)..."
            class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            [(ngModel)]="barcodeInput"
            (keydown.enter)="onBarcodeScanned()"
          />
          <mat-icon class="icon-size-4.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">qr_code_scanner</mat-icon>
        </div>
        <button
          type="button"
          (click)="onBarcodeScanned()"
          [disabled]="!barcodeInput.trim() || scanning()"
          class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap"
        >
          <mat-icon class="icon-size-4">{{ scanning() ? 'sync' : 'bolt' }}</mat-icon>
          <span>{{ scanning() ? 'Doğrulanıyor...' : 'Kodu Doğrula / Geçiş İzni Ver' }}</span>
        </button>
      </div>

      <!-- 4. Canlı Turnike Geçiş Kayıtları Tablosu (Real-time Access Logs) -->
      <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <!-- Section Header & Quick Stats -->
        <div class="p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base font-black text-slate-900 dark:text-white tracking-tight m-0">
                Canlı Geçiş Kayıtları (Access Stream)
              </h2>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                {{ filteredLogs().length }} Kayıt
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-0">
              Cihazlardan ve resepsiyondan gelen geçiş kayıtları.
            </p>
          </div>

          <!-- Quick Metrics Pills -->
          <div class="flex flex-wrap items-center gap-2">
            <div
              class="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300"
              matTooltip="Kayıtlar ve cihaz durumu 5 saniyede bir yenilenir."
            >
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="font-bold">5 sn otomatik yenileme</span>
            </div>

            <div class="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-2 text-xs">
              <span class="text-slate-500 dark:text-slate-400 font-medium">Bugün Toplam:</span>
              <strong class="text-slate-900 dark:text-white font-bold">{{ todayTotalCount() }}</strong>
            </div>
            <div class="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>İzin: <strong>{{ todayGrantedCount() }}</strong></span>
            </div>
            <div class="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
              <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              <span>Red: <strong>{{ todayDeniedCount() }}</strong></span>
            </div>
            @if (todayUnknownCount() > 0) {
              <div
                class="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                matTooltip="Cihaz bu kayıtlar için izin / red sonucu bildirmedi."
              >
                <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                <span>Sonuçsuz: <strong>{{ todayUnknownCount() }}</strong></span>
              </div>
            }
          </div>
        </div>

        <!-- Comprehensive Filter Toolbar -->
        <div class="p-4 bg-slate-50/60 dark:bg-slate-800/30 border-b border-slate-200/80 dark:border-slate-800 space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
            <!-- 1. Search Query Input -->
            <div class="lg:col-span-4 relative">
              <mat-icon class="icon-size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">search</mat-icon>
              <input
                type="text"
                [(ngModel)]="searchQuery"
                placeholder="Üye adı, turnike veya notlarda ara..."
                class="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
              @if (searchQuery()) {
                <button
                  type="button"
                  (click)="searchQuery.set('')"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <mat-icon class="icon-size-3.5">clear</mat-icon>
                </button>
              }
            </div>

            <!-- 2. Tarih Filtresi -->
            <div class="lg:col-span-3">
              <select
                [(ngModel)]="datePreset"
                class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer font-medium"
              >
                <option value="all">📅 Tarih: Tüm Zamanlar</option>
                <option value="today">📅 Tarih: Bugün</option>
                <option value="yesterday">📅 Tarih: Dün</option>
                <option value="last7">📅 Tarih: Son 7 Gün</option>
                <option value="thisMonth">📅 Tarih: Bu Ay</option>
                <option value="custom">📅 Tarih: Özel Aralık Belirle...</option>
              </select>
            </div>

            <!-- 3. Üye Filtresi -->
            <div class="lg:col-span-3">
              <select
                [(ngModel)]="selectedMemberFilter"
                class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer font-medium"
              >
                <option value="all">👤 Üye: Tüm Üyeler</option>
                @for (m of members(); track m.uid) {
                  <option [value]="m.uid">
                    👤 {{ m.displayName || m.email }}
                  </option>
                }
              </select>
            </div>

            <!-- 4. Turnike / Kapı Filtresi -->
            <div class="lg:col-span-2">
              <select
                [(ngModel)]="gateFilter"
                class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer font-medium"
              >
                <option value="all">🚪 Turnike: Tümü</option>
                @for (gate of gates(); track gate.id || gate.name) {
                  <option [value]="gate.name">{{ gate.name }}</option>
                }
              </select>
            </div>
          </div>

          <!-- Secondary Filter Controls: Status Tabs, Direction & Custom Date Range -->
          <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div class="flex flex-wrap items-center gap-2">
              <!-- Durum Filtre Butonları -->
              <div class="inline-flex items-center p-0.5 bg-slate-200/70 dark:bg-slate-800 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  (click)="logFilter.set('all')"
                  class="px-3 py-1 rounded-lg transition-all cursor-pointer"
                  [class.bg-white]="logFilter() === 'all'"
                  [class.dark:bg-slate-700]="logFilter() === 'all'"
                  [class.text-slate-900]="logFilter() === 'all'"
                  [class.dark:text-white]="logFilter() === 'all'"
                  [class.shadow-2xs]="logFilter() === 'all'"
                  [class.text-slate-500]="logFilter() !== 'all'"
                >
                  Tüm Durumlar
                </button>
                <button
                  type="button"
                  (click)="logFilter.set('granted')"
                  class="px-3 py-1 rounded-lg transition-all cursor-pointer"
                  [class.bg-white]="logFilter() === 'granted'"
                  [class.dark:bg-slate-700]="logFilter() === 'granted'"
                  [class.text-emerald-700]="logFilter() === 'granted'"
                  [class.dark:text-emerald-400]="logFilter() === 'granted'"
                  [class.shadow-2xs]="logFilter() === 'granted'"
                  [class.text-slate-500]="logFilter() !== 'granted'"
                >
                  İzin Verilenler
                </button>
                <button
                  type="button"
                  (click)="logFilter.set('denied')"
                  class="px-3 py-1 rounded-lg transition-all cursor-pointer"
                  [class.bg-white]="logFilter() === 'denied'"
                  [class.dark:bg-slate-700]="logFilter() === 'denied'"
                  [class.text-rose-700]="logFilter() === 'denied'"
                  [class.dark:text-rose-400]="logFilter() === 'denied'"
                  [class.shadow-2xs]="logFilter() === 'denied'"
                  [class.text-slate-500]="logFilter() !== 'denied'"
                >
                  Reddedilenler
                </button>
              </div>

              <!-- Yön Seçimi (IN / OUT / ALL) -->
              <div class="inline-flex items-center p-0.5 bg-slate-200/70 dark:bg-slate-800 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  (click)="directionFilter.set('all')"
                  class="px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                  [class.bg-white]="directionFilter() === 'all'"
                  [class.dark:bg-slate-700]="directionFilter() === 'all'"
                  [class.shadow-2xs]="directionFilter() === 'all'"
                  [class.text-slate-900]="directionFilter() === 'all'"
                  [class.dark:text-white]="directionFilter() === 'all'"
                  [class.text-slate-500]="directionFilter() !== 'all'"
                >
                  Tüm Yönler
                </button>
                <button
                  type="button"
                  (click)="directionFilter.set('in')"
                  class="px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                  [class.bg-white]="directionFilter() === 'in'"
                  [class.dark:bg-slate-700]="directionFilter() === 'in'"
                  [class.shadow-2xs]="directionFilter() === 'in'"
                  [class.text-sky-700]="directionFilter() === 'in'"
                  [class.dark:text-sky-400]="directionFilter() === 'in'"
                  [class.text-slate-500]="directionFilter() !== 'in'"
                >
                  Giriş (IN)
                </button>
                <button
                  type="button"
                  (click)="directionFilter.set('out')"
                  class="px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                  [class.bg-white]="directionFilter() === 'out'"
                  [class.dark:bg-slate-700]="directionFilter() === 'out'"
                  [class.shadow-2xs]="directionFilter() === 'out'"
                  [class.text-amber-700]="directionFilter() === 'out'"
                  [class.dark:text-amber-400]="directionFilter() === 'out'"
                  [class.text-slate-500]="directionFilter() !== 'out'"
                >
                  Çıkış (OUT)
                </button>
              </div>
            </div>

            <!-- Filtreleri Temizle Butonu -->
            @if (isAnyFilterActive()) {
              <button
                type="button"
                (click)="clearFilters()"
                class="px-3 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <mat-icon class="icon-size-3.5">filter_alt_off</mat-icon>
                <span>Filtreleri Sıfırla</span>
              </button>
            }
          </div>

          <!-- Özel Tarih Aralığı Seçilince Açılan Bar -->
          @if (datePreset() === 'custom') {
            <div class="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Başlangıç:</span>
                <input
                  type="date"
                  [(ngModel)]="customStartDate"
                  class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Bitiş:</span>
                <input
                  type="date"
                  [(ngModel)]="customEndDate"
                  class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <span class="text-[11px] text-slate-400">
                (Tarih aralığına göre filtrelenir)
              </span>
            </div>
          }
        </div>

        <!-- Table -->
        <div class="overflow-x-auto custom-scroll">
          <table class="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr class="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th class="py-3 px-5">Zaman</th>
                <th class="py-3 px-5">Üye</th>
                <th class="py-3 px-5">Turnike Kapısı</th>
                <th class="py-3 px-5">Yön</th>
                <th class="py-3 px-5">Yöntem</th>
                <th class="py-3 px-5">Durum & Not</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80">
              @for (log of paginatedLogs(); track log.id) {
                <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td class="py-3 px-5 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-xs">
                    {{ formatTimestamp(log.timestamp) }}
                  </td>
                  <td class="py-3 px-5">
                    <div class="flex items-center gap-2.5">
                      @if (log.userPhoto) {
                        <img [src]="log.userPhoto" class="w-7 h-7 rounded-full object-cover shrink-0" alt="avatar" />
                      } @else {
                        <span class="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {{ log.userName.charAt(0) || 'Ü' }}
                        </span>
                      }
                      <span class="font-bold text-slate-900 dark:text-white">{{ log.userName }}</span>
                    </div>
                  </td>
                  <td class="py-3 px-5 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                    {{ log.gateName }}
                  </td>
                  <td class="py-3 px-5 whitespace-nowrap">
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold"
                      [class.bg-sky-50]="log.direction === 'in'"
                      [class.dark:bg-sky-950/60]="log.direction === 'in'"
                      [class.text-sky-700]="log.direction === 'in'"
                      [class.dark:text-sky-300]="log.direction === 'in'"
                      [class.bg-amber-50]="log.direction === 'out'"
                      [class.dark:bg-amber-950/60]="log.direction === 'out'"
                      [class.text-amber-700]="log.direction === 'out'"
                      [class.dark:text-amber-300]="log.direction === 'out'"
                    >
                      <mat-icon class="icon-size-3.5">{{ log.direction === 'in' ? 'login' : 'logout' }}</mat-icon>
                      <span>{{ log.direction === 'in' ? 'GİRİŞ' : 'ÇIKIŞ' }}</span>
                    </span>
                  </td>
                  <td class="py-3 px-5 whitespace-nowrap text-slate-500 dark:text-slate-400 uppercase text-xs">
                    {{ log.method }}
                  </td>
                  <td class="py-3 px-5 whitespace-nowrap">
                    <div class="flex items-center gap-2">
                      <span
                        class="px-2.5 py-0.5 rounded-full text-[11px] font-bold border"
                        [ngClass]="statusBadgeClass(log.status)"
                        [matTooltip]="log.status === 'unknown' ? 'Cihaz bu geçiş için izin / red sonucu bildirmedi.' : ''"
                      >
                        {{ statusLabel(log.status) }}
                      </span>
                      @if (log.notes) {
                        <span class="text-xs text-slate-400 max-w-xs truncate" [title]="log.notes">{{ log.notes }}</span>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="py-12 text-center text-slate-400 text-xs">
                    @if (isAnyFilterActive()) {
                      <div class="space-y-2">
                        <p class="m-0 font-medium">Seçili filtrelere uygun turnike geçiş kaydı bulunamadı.</p>
                        <button
                          type="button"
                          (click)="clearFilters()"
                          class="px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-100 transition-all cursor-pointer"
                        >
                          Filtreleri Temizle
                        </button>
                      </div>
                    } @else {
                      <span>Henüz kayıtlı turnike geçiş hareketi bulunmuyor.</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Logs Pagination Footer -->
        @if (totalLogItems() > 0) {
          <div class="px-5 py-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
            <!-- Item Count Info -->
            <div class="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Toplam <strong class="text-slate-800 dark:text-slate-200 font-bold">{{ totalLogItems() }}</strong> kayıttan
              <strong class="text-slate-800 dark:text-slate-200 font-bold">{{ logStartIndex() + 1 }}-{{ logEndIndex() }}</strong> arası gösteriliyor
            </div>

            <!-- Controls: Page Size & Nav Buttons -->
            <div class="flex items-center gap-3">
              <!-- Page Size Selector -->
              <div class="flex items-center gap-2">
                <label class="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">Sayfa Başına:</label>
                <select
                  [ngModel]="logsPageSize()"
                  (ngModelChange)="onLogPageSizeChange($event)"
                  class="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer shadow-2xs"
                >
                  @for (sz of logsPageSizeOptions; track sz) {
                    <option [value]="sz">{{ sz }}</option>
                  }
                </select>
              </div>

              <!-- Nav Buttons -->
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  (click)="goToLogPage(1)"
                  [disabled]="logsCurrentPage() === 1"
                  class="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                  matTooltip="İlk Sayfa"
                >
                  <mat-icon class="icon-size-3.5">first_page</mat-icon>
                </button>

                <button
                  type="button"
                  (click)="prevLogPage()"
                  [disabled]="logsCurrentPage() === 1"
                  class="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                  matTooltip="Önceki Sayfa"
                >
                  <mat-icon class="icon-size-3.5">chevron_left</mat-icon>
                </button>

                @for (p of visibleLogPages(); track p) {
                  <button
                    type="button"
                    (click)="goToLogPage(p)"
                    class="min-w-7 h-7 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                    [class.bg-indigo-600]="logsCurrentPage() === p"
                    [class.text-white]="logsCurrentPage() === p"
                    [class.border]="logsCurrentPage() !== p"
                    [class.border-slate-200]="logsCurrentPage() !== p"
                    [class.dark:border-slate-700]="logsCurrentPage() !== p"
                    [class.bg-white]="logsCurrentPage() !== p"
                    [class.dark:bg-slate-800]="logsCurrentPage() !== p"
                    [class.text-slate-700]="logsCurrentPage() !== p"
                    [class.dark:text-slate-200]="logsCurrentPage() !== p"
                    [class.hover:bg-slate-100]="logsCurrentPage() !== p"
                    [class.dark:hover:bg-slate-700]="logsCurrentPage() !== p"
                  >
                    {{ p }}
                  </button>
                }

                <button
                  type="button"
                  (click)="nextLogPage()"
                  [disabled]="logsCurrentPage() === totalLogPages()"
                  class="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                  matTooltip="Sonraki Sayfa"
                >
                  <mat-icon class="icon-size-3.5">chevron_right</mat-icon>
                </button>

                <button
                  type="button"
                  (click)="goToLogPage(totalLogPages())"
                  [disabled]="logsCurrentPage() === totalLogPages()"
                  class="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                  matTooltip="Son Sayfa"
                >
                  <mat-icon class="icon-size-3.5">last_page</mat-icon>
                </button>
              </div>
            </div>
          </div>
        }
      </section>

      <!-- 5. Yeni Turnike Tanımlama Slide-Over Paneli -->
      <app-slide-over
        [open]="isAddGateOpen()"
        title="Yeni Cihaz Tanımla"
        submitLabel="Cihazı Kaydet"
        [submitting]="savingGate()"
        [errorMessage]="addGateError()"
        (closed)="closeAddGateDrawer()"
        (submitted)="saveNewGate()"
      >
        <div class="space-y-4">
          <!-- Gate Name -->
          <div>
            <label class="odv-label required">Turnike / Kapı Adı</label>
            <input
              type="text"
              [(ngModel)]="newGate.name"
              placeholder="Örn: Turnike 01 (Ana Giriş)"
              class="odv-input"
            />
          </div>

          <!-- Location -->
          <div>
            <label class="odv-label required">Konum / Bölge</label>
            <input
              type="text"
              [(ngModel)]="newGate.location"
              placeholder="Örn: Giriş Holü - Turnike A"
              class="odv-input"
            />
          </div>

          <!-- Direction & Status -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="odv-label required">Geçiş Yönü</label>
              <select [(ngModel)]="newGate.direction" class="odv-input">
                <option value="in">Giriş (IN)</option>
                <option value="out">Çıkış (OUT)</option>
                <option value="both">Çift Yönlü (Giriş/Çıkış)</option>
              </select>
            </div>
            <div>
              <label class="odv-label required">Okuyucu Donanımı</label>
              <select [(ngModel)]="newGate.readerType" class="odv-input">
                <option value="YT Yüz & Kart Terminali">YT Yüz & Kart Terminali</option>
                <option value="Perkotek YT-32 Yüz & Kart">Perkotek YT-32 Yüz & Kart Terminali</option>
                <option value="Dinamik QR + NFC Mifare">Dinamik QR + NFC Mifare</option>
                <option value="Dinamik QR Okuyucu">Dinamik QR Okuyucu</option>
                <option value="Dinamik QR + Optik Sensör">Dinamik QR + Optik Sensör</option>
                <option value="Yüz Tanıma Terminali">Yüz Tanıma Terminali (IP / Standalone)</option>
                <option value="Mifare 13.56MHz RFID">Mifare 13.56MHz RFID</option>
              </select>
            </div>
          </div>

          <!-- Protokol -->
          <div class="pt-2">
            <label class="odv-label required">Cihaz Protokolü</label>
            <div class="grid grid-cols-1 gap-2.5 mt-1.5">
              @for (proto of deviceProtocols; track proto.value) {
                <label
                  (click)="setProtocol(proto.value)"
                  class="p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3"
                  [class.border-indigo-600]="newGate.protocol === proto.value"
                  [class.bg-indigo-50/40]="newGate.protocol === proto.value"
                  [class.dark:bg-indigo-950/30]="newGate.protocol === proto.value"
                  [class.border-slate-200]="newGate.protocol !== proto.value"
                  [class.dark:border-slate-800]="newGate.protocol !== proto.value"
                >
                  <input
                    type="radio"
                    name="protocol"
                    [value]="proto.value"
                    [checked]="newGate.protocol === proto.value"
                    class="mt-1 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span class="text-xs font-bold text-slate-900 dark:text-white">{{ proto.label }}</span>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 mb-0">{{ proto.hint }}</p>
                  </div>
                </label>
              }
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2">
              <label class="odv-label required">Cihazın Yerel IP Adresi</label>
              <input type="text" [(ngModel)]="newGate.host" placeholder="192.168.1.201" class="odv-input font-mono text-xs" />
            </div>
            <div>
              <label class="odv-label">Port</label>
              <input type="number" [(ngModel)]="newGate.port" class="odv-input font-mono text-xs" />
            </div>
          </div>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 m-0">
            Cihaz kullanıcı adı ve parolası buluta gönderilmez; salondaki bilgisayarda Edge Agent'ın
            <code>config.json</code> dosyasına yazılır.
          </p>
        </div>
      </app-slide-over>

      <!-- 6. Üye senkron ayrıntısı -->
      <app-slide-over
        [open]="!!syncGate()"
        [title]="'Üye Senkronu · ' + (syncGate()?.name || '')"
        submitLabel="Tümünü Yeniden Senkronla"
        [submitting]="resyncing()"
        (closed)="closeSyncDrawer()"
        (submitted)="resyncGate()"
      >
        <div class="space-y-3">
          <div class="inline-flex items-center p-0.5 bg-slate-200/70 dark:bg-slate-800 rounded-xl text-xs font-semibold">
            @for (f of syncFilters; track f.value) {
              <button
                type="button"
                (click)="setSyncFilter(f.value)"
                class="px-3 py-1 rounded-lg transition-all cursor-pointer"
                [class.bg-white]="syncFilter() === f.value"
                [class.dark:bg-slate-700]="syncFilter() === f.value"
                [class.shadow-2xs]="syncFilter() === f.value"
                [class.text-slate-500]="syncFilter() !== f.value"
              >
                {{ f.label }}
              </button>
            }
          </div>

          @if (syncLoading()) {
            <p class="text-xs text-slate-400 m-0">Yükleniyor…</p>
          }
          <div class="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
            @for (item of syncItems(); track item.id) {
              <div class="p-3 flex items-start justify-between gap-3 text-xs">
                <div class="min-w-0">
                  <div class="font-bold text-slate-900 dark:text-white truncate">{{ item.name || item.userId }}</div>
                  <div class="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    No {{ item.userId }} · Kart {{ item.card || '—' }} · Bitiş {{ formatDay(item.validEnd) }}
                    @if (!item.enabled) {
                      · <span class="text-rose-600 dark:text-rose-400">yetki kapalı</span>
                    }
                  </div>
                  @if (item.status === 'error' && item.lastError) {
                    <div class="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">{{ item.lastError }}</div>
                  }
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap" [ngClass]="syncBadgeClass(item.status)">
                  {{ syncStatusLabel(item.status) }}
                </span>
              </div>
            } @empty {
              <p class="p-4 text-xs text-slate-400 text-center m-0">Bu filtrede kayıt yok.</p>
            }
          </div>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 m-0">
            "Uygulandı" yalnızca agent cihazdan geri okuyup doğruladığında gösterilir. Yeniden senkron,
            bu cihaz için tüm üyelerin yetkisini yeniden hesaplayıp beklemeye alır.
          </p>
        </div>
      </app-slide-over>

      <!-- 7. Edge Agent eşleştirme ve durum -->
      @if (showAgentWizard()) {
        <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 font-sans animate-in fade-in duration-200">
          <div class="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div class="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
              <div class="flex items-center gap-3.5">
                <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                  <mat-icon class="icon-size-6">developer_board</mat-icon>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white m-0">Edge Agent</h3>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">v2</span>
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-0">
                    Salondaki bilgisayarda çalışır, cihazlarla yerel ağda konuşur ve MainApi'ye yalnızca giden HTTPS ile bağlanır.
                  </p>
                </div>
              </div>
              <button
                type="button"
                (click)="closeAgentWizard()"
                class="w-9 h-9 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <mat-icon class="icon-size-5">close</mat-icon>
              </button>
            </div>

            <div class="flex items-center gap-2 px-6 pt-3 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              @for (tab of wizardTabs; track tab.value) {
                <button
                  type="button"
                  (click)="wizardTab.set(tab.value)"
                  class="px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer"
                  [class.border-indigo-600]="wizardTab() === tab.value"
                  [class.text-indigo-600]="wizardTab() === tab.value"
                  [class.dark:text-indigo-400]="wizardTab() === tab.value"
                  [class.border-transparent]="wizardTab() !== tab.value"
                  [class.text-slate-500]="wizardTab() !== tab.value"
                >
                  <mat-icon class="icon-size-4">{{ tab.icon }}</mat-icon>
                  <span>{{ tab.label }}</span>
                </button>
              }
            </div>

            <div class="p-6 overflow-y-auto space-y-6">
              @if (wizardTab() === 'pair') {
                <div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
                  <div class="flex items-center gap-3.5">
                    <div class="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                      <mat-icon class="text-2xl">folder_zip</mat-icon>
                    </div>
                    <div>
                      <span class="font-extrabold text-sm sm:text-base block">OdivonGYM Edge Agent (Windows)</span>
                      <span class="text-xs text-slate-300 mt-0.5 block">Node.js 22.13+ gerekir; ek paket kurulmaz. Firebase anahtarı gerekmez.</span>
                    </div>
                  </div>
                  <a
                    href="/downloads/odivon-gym-edge-agent.zip"
                    download="odivon-gym-edge-agent.zip"
                    class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/30 transition-all whitespace-nowrap self-start sm:self-auto cursor-pointer no-underline flex items-center gap-2"
                  >
                    <mat-icon class="icon-size-4">download</mat-icon>
                    <span>Agent'ı İndir (.ZIP)</span>
                  </a>
                </div>

                <!-- Adım 1: cihaz seç ve kod üret -->
                <div class="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <h4 class="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white m-0">1. Agent'ın yöneteceği cihazları seçin</h4>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    @for (gate of gates(); track gate.id) {
                      <label class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" [checked]="pairGateIds().includes(gate.id!)" (change)="togglePairGate(gate.id!)" />
                        <span class="font-bold text-slate-800 dark:text-slate-200">{{ gate.name }}</span>
                        <span class="font-mono text-[11px] text-slate-400">{{ gate.host || '—' }}</span>
                      </label>
                    } @empty {
                      <p class="text-xs text-slate-500 m-0">Önce "Yeni Cihaz Ekle" ile cihaz tanımlayın.</p>
                    }
                  </div>
                  <div class="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      (click)="generatePairingCode()"
                      [disabled]="pairGateIds().length === 0 || generatingCode()"
                      class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    >
                      <mat-icon class="icon-size-4">key</mat-icon>
                      <span>{{ generatingCode() ? 'Oluşturuluyor…' : 'Eşleştirme Kodu Oluştur' }}</span>
                    </button>
                    @if (pairingCode(); as pc) {
                      <span class="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 font-mono text-base font-black tracking-widest text-emerald-700 dark:text-emerald-300 select-all">
                        {{ pc.code }}
                      </span>
                      <span class="text-[11px] text-slate-500 dark:text-slate-400">
                        Tek kullanımlık, {{ formatClock(pc.expiresAt) }} saatine kadar geçerli.
                      </span>
                    }
                  </div>
                </div>

                <!-- Adım 2: config.json -->
                <div class="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 class="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white m-0">2. config.json</h4>
                      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-0">
                        Cihaz parolasını salondaki bilgisayarda bu dosyaya yazın; buluta gönderilmez.
                      </p>
                    </div>
                    <div class="flex items-center gap-2">
                      <button type="button" (click)="copyConfigJson()" class="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                        <mat-icon class="icon-size-4">content_copy</mat-icon>
                        <span>Kopyala</span>
                      </button>
                      <button type="button" (click)="downloadConfigFile()" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                        <mat-icon class="icon-size-4">download</mat-icon>
                        <span>İndir</span>
                      </button>
                    </div>
                  </div>
                  <div class="rounded-xl bg-slate-950 text-slate-200 p-4 font-mono text-xs border border-slate-800 max-h-48 overflow-y-auto">
                    <pre class="m-0 leading-relaxed">{{ generatedConfigJson() }}</pre>
                  </div>
                </div>

                <!-- Adım 3 -->
                <div class="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <h4 class="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white m-0">3. Başlatın</h4>
                  <p class="m-0">
                    <b>baslat.bat</b> dosyasına çift tıklayın; ilk açılışta eşleştirme kodunu sorar. Ardından yönetici izni
                    isteyip agent'ı Windows açılışında otomatik başlayacak şekilde kurar (kimse oturum açmasa bile çalışır,
                    kapanırsa 1 dakikada yeniden başlar). Pencereyi kapatabilirsiniz.
                  </p>
                  <p class="m-0">Otomatik başlatmayı kaldırmak için: <code>servis-kur.bat kaldir</code></p>
                </div>
              }

              @if (wizardTab() === 'agents') {
                <div class="space-y-3">
                  @for (agent of agents(); track agent.id) {
                    <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-sm text-slate-900 dark:text-white">{{ agent.name }}</span>
                          @if (agent.revokedAt) {
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">İptal edildi</span>
                          } @else if (agent.online) {
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">Çevrimiçi</span>
                          } @else {
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">Çevrimdışı</span>
                          }
                        </div>
                        <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {{ agent.hostname || '—' }} · v{{ agent.agentVersion || '?' }} · Son heartbeat: {{ formatRelative(agent.lastHeartbeatAt) }}
                        </div>
                        <div class="text-[11px] text-slate-500 dark:text-slate-400">Cihazlar: {{ gateNames(agent.gateIds) }}</div>
                      </div>
                      @if (!agent.revokedAt) {
                        <button
                          type="button"
                          (click)="revokeAgent(agent)"
                          class="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-bold cursor-pointer self-start sm:self-auto"
                        >
                          İptal Et
                        </button>
                      }
                    </div>
                  } @empty {
                    <p class="text-xs text-slate-500 dark:text-slate-400 m-0">Henüz eşleştirilmiş agent yok.</p>
                  }
                </div>
              }

              @if (wizardTab() === 'guide') {
                <div class="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <div class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-2">
                    <h4 class="text-sm font-bold text-slate-900 dark:text-white m-0">Canlıya almadan önce donanım testi</h4>
                    <p class="m-0">
                      Test kartıyla cihazda kullanıcı oluşturma, kart değiştirme, iptal ve bitiş günü sonunda geçişin
                      gerçekten engellendiğini doğrulayın; cihazı yeniden başlatıp yetkilerin korunduğunu kontrol edin.
                      Cihaz saatinin Türkiye saatinde olduğundan emin olun.
                    </p>
                  </div>
                  <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                    <h4 class="text-sm font-bold text-slate-900 dark:text-white m-0">Eski agent'tan geçiş</h4>
                    <p class="m-0">
                      Yeni agent'ın olay akışı ve üye senkronu doğrulandıktan sonra Firestore'a doğrudan yazan eski agent'ı
                      durdurun, bilgisayardaki <code>serviceAccountKey.json</code> dosyasını silin ve Firebase Console'da
                      ilgili hizmet hesabı anahtarını iptal edin.
                    </p>
                  </div>
                  <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                    <h4 class="text-sm font-bold text-slate-900 dark:text-white m-0">Bilgisayar açılınca otomatik başlatma</h4>
                    <p class="m-0">
                      <b>baslat.bat</b> eşleştirmeden sonra bunu kendisi kurar (Windows Görev Zamanlayıcı, "Odivon Edge Agent").
                      Elle kurmak için <b>servis-kur.bat</b>, kaldırmak için <code>servis-kur.bat kaldir</code>. BIOS'ta
                      "elektrik gelince otomatik aç" seçeneğini açmanız önerilir.
                    </p>
                  </div>
                </div>
              }
            </div>

            <div class="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                (click)="closeAgentWizard()"
                class="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminAccessControl implements OnInit {
  private readonly accessService = inject(AdminAccessControlService);
  private readonly membersService = inject(AdminMembersService);
  private readonly alertService = inject(AlertService);
  private readonly auth = inject(AuthService);
  protected readonly saasSub = inject(SaasSubscriptionService);

  protected readonly deviceProtocols = DEVICE_PROTOCOLS;

  // Edge Agent penceresi
  protected readonly showAgentWizard = signal(false);
  protected readonly wizardTab = signal<'pair' | 'agents' | 'guide'>('pair');
  protected readonly wizardTabs = [
    { value: 'pair' as const, label: 'Eşleştir & Kur', icon: 'link' },
    { value: 'agents' as const, label: 'Agent Durumu', icon: 'monitor_heart' },
    { value: 'guide' as const, label: 'Test & Geçiş', icon: 'menu_book' },
  ];
  protected readonly pairGateIds = signal<string[]>([]);
  protected readonly pairingCode = signal<{ code: string; expiresAt: string } | null>(null);
  protected readonly generatingCode = signal(false);

  openAgentWizard(): void {
    this.pairingCode.set(null);
    this.pairGateIds.set(this.gates().filter((g) => g.id && !g.agentId).map((g) => g.id!));
    this.showAgentWizard.set(true);
  }

  closeAgentWizard(): void {
    this.showAgentWizard.set(false);
  }

  protected togglePairGate(gateId: string): void {
    this.pairGateIds.update((ids) => (ids.includes(gateId) ? ids.filter((id) => id !== gateId) : [...ids, gateId]));
  }

  protected async generatePairingCode(): Promise<void> {
    this.generatingCode.set(true);
    try {
      this.pairingCode.set(await this.accessService.createPairingCode(this.pairGateIds()));
    } catch (e: any) {
      this.alertService.toastError(e?.error?.error?.message || e?.message || 'Eşleştirme kodu oluşturulamadı.');
    } finally {
      this.generatingCode.set(false);
    }
  }

  protected async revokeAgent(agent: AccessAgent): Promise<void> {
    const ok = await this.alertService.deleteConfirm(
      agent.name,
      'Agent kimliği iptal edilir ve cihazlarıyla bağlantısı kesilir. Yeniden kullanmak için yeni eşleştirme kodu gerekir.',
    );
    if (!ok) return;
    await this.accessService.revokeAgent(agent.id);
    this.alertService.toastSuccess(`${agent.name} iptal edildi.`);
  }

  protected gateNames(ids: string[] | undefined): string {
    const names = (ids ?? []).map((id) => this.gates().find((g) => g.id === id)?.name ?? id);
    return names.length ? names.join(', ') : '—';
  }

  protected readonly generatedConfigJson = computed(() => {
    const hosts = this.gates()
      .filter((g) => g.id && this.pairGateIds().includes(g.id) && g.host)
      .map((g) => g.host!);
    const credentials = Object.fromEntries(
      (hosts.length ? hosts : ['192.168.1.201']).map((host) => [host, { username: 'admin', password: 'CIHAZ_PAROLASI' }]),
    );
    return JSON.stringify(
      {
        mainApiUrl: environment.apiBaseUrl.startsWith('http') ? environment.apiBaseUrl : 'https://mainapi.odivon.com/api/v1',
        agentName: 'Resepsiyon PC',
        pollIntervalSeconds: 5,
        heartbeatIntervalSeconds: 15,
        dataDir: './data',
        credentials,
      },
      null,
      2,
    );
  });

  downloadConfigFile(): void {
    const blob = new Blob([this.generatedConfigJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    a.click();
    URL.revokeObjectURL(url);
    this.alertService.toastSuccess('config.json indirildi. Cihaz parolasını dosyada düzenleyin.');
  }

  copyConfigJson(): void {
    navigator.clipboard.writeText(this.generatedConfigJson());
    this.alertService.toastSuccess('Yapılandırma panoya kopyalandı.');
  }

  protected readonly gates = toSignal(this.accessService.watchGates(), { initialValue: [] });
  protected readonly agents = toSignal(this.accessService.watchAgents(), { initialValue: [] });
  private readonly syncSummary = toSignal(this.accessService.watchSyncSummary(), { initialValue: {} as DeviceSyncSummary });
  protected readonly members = toSignal(this.membersService.watchMembers(), { initialValue: [] });
  private readonly logs = toSignal(this.accessService.watchLogs(), { initialValue: [] });

  // Üye senkron ayrıntısı
  protected readonly syncGate = signal<TurnstileGate | null>(null);
  protected readonly syncItems = signal<DeviceSyncItem[]>([]);
  protected readonly syncLoading = signal(false);
  protected readonly resyncing = signal(false);
  protected readonly syncFilter = signal<DeviceSyncStatus | 'all'>('all');
  protected readonly syncFilters: { value: DeviceSyncStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Tümü' },
    { value: 'pending', label: 'Bekliyor' },
    { value: 'applied', label: 'Uygulandı' },
    { value: 'error', label: 'Hata' },
  ];

  protected syncCount(gate: TurnstileGate, status: 'pending' | 'applied' | 'error'): number {
    const counts = gate.id ? this.syncSummary()[gate.id] : undefined;
    if (!counts) return 0;
    // "delivered" = agent'a teslim edildi, cihazda henüz doğrulanmadı → bekliyor sayılır.
    return status === 'pending' ? (counts.pending ?? 0) + (counts.delivered ?? 0) : (counts[status] ?? 0);
  }

  protected async openSyncDrawer(gate: TurnstileGate): Promise<void> {
    this.syncGate.set(gate);
    this.syncFilter.set('all');
    await this.loadSyncItems();
  }

  protected closeSyncDrawer(): void {
    this.syncGate.set(null);
    this.syncItems.set([]);
  }

  protected async setSyncFilter(filter: DeviceSyncStatus | 'all'): Promise<void> {
    this.syncFilter.set(filter);
    await this.loadSyncItems();
  }

  private async loadSyncItems(): Promise<void> {
    const gate = this.syncGate();
    if (!gate?.id) return;
    this.syncLoading.set(true);
    try {
      const filter = this.syncFilter();
      const items = await this.accessService.listSync(gate.id, filter === 'all' || filter === 'pending' ? undefined : filter);
      this.syncItems.set(filter === 'pending' ? items.filter((i) => i.status === 'pending' || i.status === 'delivered') : items);
    } catch {
      this.alertService.toastError('Senkron durumu alınamadı.');
    } finally {
      this.syncLoading.set(false);
    }
  }

  protected async resyncGate(): Promise<void> {
    const gate = this.syncGate();
    if (!gate?.id) return;
    this.resyncing.set(true);
    try {
      await this.accessService.resync(gate.id);
      this.alertService.toastSuccess(`${gate.name} için tüm üye yetkileri yeniden kuyruğa alındı.`);
      await this.loadSyncItems();
    } catch {
      this.alertService.toastError('Yeniden senkron başlatılamadı.');
    } finally {
      this.resyncing.set(false);
    }
  }

  protected syncStatusLabel(status: DeviceSyncStatus): string {
    return { pending: 'Bekliyor', delivered: 'Bekliyor', applied: 'Cihaza uygulandı', error: 'Hata' }[status] ?? status;
  }

  protected syncBadgeClass(status: DeviceSyncStatus): string {
    if (status === 'applied') return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';
    if (status === 'error') return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60';
    return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60';
  }

  protected statusLabel(status: AccessStatus): string {
    if (status === 'granted') return 'İzin Verildi';
    if (status === 'unknown') return 'Sonuç bildirilmedi';
    if (status === 'anti_passback_warning') return 'Anti-passback';
    return 'Reddedildi';
  }

  protected statusBadgeClass(status: AccessStatus): string {
    if (status === 'granted') return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';
    if (status === 'unknown') return 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60';
  }

  protected protocolLabel(protocol: DeviceProtocol | undefined): string {
    return DEVICE_PROTOCOLS.find((p) => p.value === protocol)?.label ?? 'Protokol seçilmedi';
  }

  protected formatRelative(value: string | null | undefined): string {
    if (!value) return '—';
    const ms = new Date(value).getTime();
    if (Number.isNaN(ms)) return '—';
    const secs = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (secs < 60) return `${secs} sn önce`;
    if (secs < 3600) return `${Math.round(secs / 60)} dk önce`;
    return new Date(ms).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  }

  protected formatClock(value: string): string {
    return new Date(value).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  protected formatDay(day: string | null | undefined): string {
    if (!day || day.length !== 8) return '—';
    return `${day.slice(6, 8)}.${day.slice(4, 6)}.${day.slice(0, 4)}`;
  }

  // Filtering Signals
  protected readonly searchQuery = signal('');
  protected readonly logFilter = signal<'all' | 'granted' | 'denied'>('all');
  protected readonly datePreset = signal<'all' | 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'custom'>('all');
  protected readonly customStartDate = signal('');
  protected readonly customEndDate = signal('');
  protected readonly selectedMemberFilter = signal('all');
  protected readonly gateFilter = signal('all');
  protected readonly directionFilter = signal<'all' | 'in' | 'out'>('all');

  protected readonly openingGate = signal<string | null>(null);
  protected readonly scanning = signal(false);
  protected readonly lastResult = signal<GateScanResult | null>(null);

  // Reception Barcode / RFID Reader
  protected barcodeInput = '';

  // Add Gate SlideOver state
  protected readonly isAddGateOpen = signal(false);
  protected readonly savingGate = signal(false);
  protected readonly addGateError = signal('');
  protected newGate: {
    name: string;
    location: string;
    direction: AccessDirection | 'both';
    readerType: string;
    protocol: DeviceProtocol;
    host: string;
    port: number | null;
  } = this.emptyGate();

  private emptyGate() {
    return {
      name: '',
      location: '',
      direction: 'in' as AccessDirection | 'both',
      readerType: 'YT Yüz & Kart Terminali',
      protocol: 'yt-http-digest' as DeviceProtocol,
      host: '',
      port: 80 as number | null,
    };
  }

  ngOnInit(): void {
    // Sabit / demo veri enjekte edilmez; tüm kayıtlar gerçek veritabanından dinamik gelir.
  }

  protected readonly isAnyFilterActive = computed(() => {
    return (
      this.logFilter() !== 'all' ||
      this.datePreset() !== 'all' ||
      this.customStartDate() !== '' ||
      this.customEndDate() !== '' ||
      this.selectedMemberFilter() !== 'all' ||
      this.gateFilter() !== 'all' ||
      this.directionFilter() !== 'all' ||
      this.searchQuery().trim() !== ''
    );
  });

  protected clearFilters(): void {
    this.logFilter.set('all');
    this.datePreset.set('all');
    this.customStartDate.set('');
    this.customEndDate.set('');
    this.selectedMemberFilter.set('all');
    this.gateFilter.set('all');
    this.directionFilter.set('all');
    this.searchQuery.set('');
    this.logsCurrentPage.set(1);
  }

  protected readonly todayTotalCount = computed(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    return this.logs().filter((l) => this.getLogMillis(l.timestamp) >= startOfToday).length;
  });

  protected readonly todayGrantedCount = computed(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    return this.logs().filter((l) => l.status === 'granted' && this.getLogMillis(l.timestamp) >= startOfToday).length;
  });

  protected readonly todayDeniedCount = computed(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    return this.logs().filter((l) => l.status === 'denied' && this.getLogMillis(l.timestamp) >= startOfToday).length;
  });

  protected readonly todayUnknownCount = computed(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    return this.logs().filter((l) => l.status === 'unknown' && this.getLogMillis(l.timestamp) >= startOfToday).length;
  });

  protected readonly filteredLogs = computed(() => {
    let list = [...this.logs()];

    // 1. Sort newest first
    list.sort((a, b) => {
      const ta = this.getLogMillis(a.timestamp);
      const tb = this.getLogMillis(b.timestamp);
      return tb - ta;
    });

    // 2. Status filter
    const status = this.logFilter();
    if (status === 'granted') {
      list = list.filter((l) => l.status === 'granted');
    } else if (status === 'denied') {
      list = list.filter((l) => l.status === 'denied' || l.status === 'anti_passback_warning');
    }

    // 3. Direction filter
    const dir = this.directionFilter();
    if (dir !== 'all') {
      list = list.filter((l) => l.direction === dir);
    }

    // 4. Gate filter
    const gate = this.gateFilter();
    if (gate !== 'all') {
      list = list.filter((l) => l.gateName === gate);
    }

    // 5. Member filter
    const memberId = this.selectedMemberFilter();
    if (memberId !== 'all') {
      list = list.filter((l) => l.userId === memberId);
    }

    // 6. Search query
    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter((l) =>
        (l.userName && l.userName.toLowerCase().includes(q)) ||
        (l.gateName && l.gateName.toLowerCase().includes(q)) ||
        (l.notes && l.notes.toLowerCase().includes(q)) ||
        (l.method && l.method.toLowerCase().includes(q))
      );
    }

    // 7. Date filter
    const preset = this.datePreset();
    if (preset !== 'all') {
      const now = new Date();
      let startMs = 0;
      let endMs = Infinity;

      if (preset === 'today') {
        startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
        endMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
      } else if (preset === 'yesterday') {
        startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0).getTime();
        endMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999).getTime();
      } else if (preset === 'last7') {
        startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0).getTime();
        endMs = now.getTime();
      } else if (preset === 'thisMonth') {
        startMs = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
        endMs = now.getTime();
      } else if (preset === 'custom') {
        const s = this.customStartDate();
        const e = this.customEndDate();
        if (s) {
          const sd = new Date(s);
          sd.setHours(0, 0, 0, 0);
          startMs = sd.getTime();
        }
        if (e) {
          const ed = new Date(e);
          ed.setHours(23, 59, 59, 999);
          endMs = ed.getTime();
        }
      }

      list = list.filter((l) => {
        const ms = this.getLogMillis(l.timestamp);
        if (!ms) return false;
        return ms >= startMs && ms <= endMs;
      });
    }

    return list;
  });

  // Access Logs Pagination Signals & Computed Values
  protected readonly logsCurrentPage = signal(1);
  protected readonly logsPageSize = signal(25);
  protected readonly logsPageSizeOptions = [15, 25, 50, 100];

  protected readonly totalLogItems = computed(() => this.filteredLogs().length);
  protected readonly totalLogPages = computed(() => Math.max(1, Math.ceil(this.totalLogItems() / this.logsPageSize())));
  protected readonly logStartIndex = computed(() => (this.logsCurrentPage() - 1) * this.logsPageSize());
  protected readonly logEndIndex = computed(() => Math.min(this.logStartIndex() + this.logsPageSize(), this.totalLogItems()));

  protected readonly paginatedLogs = computed(() => {
    const start = this.logStartIndex();
    return this.filteredLogs().slice(start, start + this.logsPageSize());
  });

  protected readonly visibleLogPages = computed<number[]>(() => {
    const current = this.logsCurrentPage();
    const total = this.totalLogPages();
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  protected goToLogPage(page: number): void {
    if (page >= 1 && page <= this.totalLogPages()) {
      this.logsCurrentPage.set(page);
    }
  }

  protected nextLogPage(): void {
    if (this.logsCurrentPage() < this.totalLogPages()) {
      this.logsCurrentPage.set(this.logsCurrentPage() + 1);
    }
  }

  protected prevLogPage(): void {
    if (this.logsCurrentPage() > 1) {
      this.logsCurrentPage.set(this.logsCurrentPage() - 1);
    }
  }

  protected onLogPageSizeChange(size: number | string): void {
    this.logsPageSize.set(Number(size));
    this.logsCurrentPage.set(1);
  }

  protected getGateTodayPasses(gate: TurnstileGate): number {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    return this.logs().filter(
      (l) => (l.gateId ? l.gateId === gate.id : l.gateName === gate.name) && this.getLogMillis(l.timestamp) >= startOfToday,
    ).length;
  }

  protected async deleteGate(gate: TurnstileGate): Promise<void> {
    if (!gate.id) return;
    const ok = await this.alertService.deleteConfirm(gate.name, 'Bu turnike erişim kontrol sisteminden kalıcı olarak silinecektir.');
    if (ok) {
      await this.accessService.deleteGate(gate.id);
      this.alertService.toastSuccess(`${gate.name} silindi.`);
    }
  }

  protected setProtocol(proto: DeviceProtocol): void {
    this.newGate.protocol = proto;
    this.newGate.port = DEVICE_PROTOCOLS.find((p) => p.value === proto)?.defaultPort || null;
  }

  protected openAddGateDrawer(): void {
    this.addGateError.set('');
    this.newGate = this.emptyGate();
    this.isAddGateOpen.set(true);
  }

  protected closeAddGateDrawer(): void {
    this.isAddGateOpen.set(false);
    this.addGateError.set('');
  }

  protected async saveNewGate(): Promise<void> {
    if (this.savingGate()) return;
    this.addGateError.set('');
    if (!this.newGate.name.trim()) {
      const msg = 'Lütfen cihaz / kapı adını giriniz.';
      this.addGateError.set(msg);
      this.alertService.toastError(msg);
      return;
    }
    if (!this.newGate.location.trim()) {
      const msg = 'Lütfen konum / bölge bilgisini giriniz.';
      this.addGateError.set(msg);
      this.alertService.toastError(msg);
      return;
    }
    if (!/^\d{1,3}(\.\d{1,3}){3}$|^[a-zA-Z0-9.-]+$/.test(this.newGate.host.trim())) {
      const msg = 'Lütfen cihazın yerel IP adresini giriniz (örn. 192.168.1.201).';
      this.addGateError.set(msg);
      this.alertService.toastError(msg);
      return;
    }

    this.savingGate.set(true);
    try {
      await this.accessService.createGate({
        name: this.newGate.name.trim(),
        location: this.newGate.location.trim(),
        direction: this.newGate.direction,
        readerType: this.newGate.readerType,
        protocol: this.newGate.protocol,
        host: this.newGate.host.trim(),
        port: this.newGate.port ? Number(this.newGate.port) : null,
      });

      this.alertService.toastSuccess('Cihaz kaydedildi. Şimdi Edge Agent ile eşleştirin.');
      this.isAddGateOpen.set(false);
    } catch (e: any) {
      const msg = e?.error?.error?.message || e.message || 'Cihaz kaydedilirken hata oluştu.';
      this.addGateError.set(msg);
      this.alertService.toastError(msg);
    } finally {
      this.savingGate.set(false);
    }
  }

  protected async onBarcodeScanned(): Promise<void> {
    const code = this.barcodeInput.trim();
    if (!code || this.scanning()) return;

    this.scanning.set(true);
    try {
      const firstGateName = this.gates()[0]?.name || 'Turnike (Giriş)';
      const result = await this.accessService.validateAndProcessDynamicQrToken(
        code,
        'in',
        firstGateName,
      );
      this.lastResult.set(result);
      this.barcodeInput = '';

      if (result.allowed) {
        this.alertService.toastSuccess(`${result.userName}: Geçiş onaylandı!`);
      } else {
        this.alertService.toastError(`${result.userName}: ${result.message}`);
      }
    } catch (err: any) {
      this.alertService.toastError(err.message || 'Geçiş okunamadı.');
    } finally {
      this.scanning.set(false);
    }
  }

  private getLogMillis(ts: any): number {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    if (ts.seconds) return ts.seconds * 1000;
    if (ts instanceof Date) return ts.getTime();
    const parsed = new Date(ts).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }

  protected formatTimestamp(ts: any): string {
    const ms = this.getLogMillis(ts);
    if (!ms) return '—';
    const date = new Date(ms);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' · ' + date.toLocaleDateString('tr-TR');
  }
}
