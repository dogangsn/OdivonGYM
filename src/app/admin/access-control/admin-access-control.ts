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
  AdminAccessControlService,
  GateScanResult,
  TurnstileGate,
  TurnstileConnectionProtocol,
} from './admin-access-control.service';
import { AdminMembersService } from '../members/admin-members.service';
import { AccessDirection, AccessLog, AccessMethod, AccessStatus } from '../../core/models/access-log.model';
import { UserProfile } from '../../core/models/user-profile.model';
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
        description="Fiziksel turnikeleri canlı izle, QR/RFID geçiş kayıtlarını denetle ve uzaktan kapı aç."
      >
        <div actions class="flex items-center gap-2">
          <button
            type="button"
            (click)="openAgentWizard()"
            class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <mat-icon class="icon-size-4">hub</mat-icon>
            <span>Cihaz & Edge Agent Kurulumu</span>
          </button>

          <button
            type="button"
            (click)="triggerEmergencyUnlock()"
            class="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
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
            <span>Yeni Turnike Ekle</span>
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

      <!-- 2. Turnstile Hardware Grid -->
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
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Çevrimiçi
                  </span>
                  <button
                    type="button"
                    (click)="deleteGate(gate)"
                    matTooltip="Turnikeyi Sil"
                    class="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center justify-center transition-all cursor-pointer"
                  >
                    <mat-icon class="icon-size-4">delete</mat-icon>
                  </button>
                </div>
              </div>

              <!-- Protocols & Badges -->
              <div class="flex flex-wrap items-center gap-1.5 mt-3">
                <!-- Protocol Badge -->
                @if (gate.connectionProtocol === 'reverse_tunnel') {
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                    <mat-icon class="icon-size-3">vpn_lock</mat-icon>
                    Ters Tünel (Edge Mesh)
                  </span>
                } @else if (gate.connectionProtocol === 'mqtt') {
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60">
                    <mat-icon class="icon-size-3">sensors</mat-icon>
                    MQTT Broker
                  </span>
                } @else {
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                    <mat-icon class="icon-size-3">wifi_tethering</mat-icon>
                    WebSocket (WSS)
                  </span>
                }

                <!-- Direction Badge -->
                <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {{ gate.direction === 'in' ? 'Yalnızca Giriş' : gate.direction === 'out' ? 'Yalnızca Çıkış' : 'Çift Yönlü (Giriş/Çıkış)' }}
                </span>
              </div>

              <!-- Gate Details -->
              <div class="grid grid-cols-2 gap-3 mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                <div>
                  <span class="text-[11px] text-slate-400 block">Okuyucu Donanımı</span>
                  <span class="font-bold text-slate-800 dark:text-slate-200 truncate block">{{ gate.readerType }}</span>
                </div>
                <div>
                  <span class="text-[11px] text-slate-400 block">Uç Nokta / Port</span>
                  <span class="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate block" [title]="gate.endpoint">
                    {{ gate.endpoint }}{{ gate.port ? ':' + gate.port : '' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Manual Open Trigger Button -->
            <div class="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <span class="text-xs text-slate-400">
                Bugün: <strong class="text-slate-700 dark:text-slate-200">{{ getGateTodayPasses(gate.name) }}</strong> Geçiş
              </span>
              <button
                type="button"
                (click)="openGateManually(gate)"
                [disabled]="openingGate() === gate.id"
                class="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <mat-icon class="icon-size-3.5">{{ openingGate() === gate.id ? 'sync' : 'lock_open' }}</mat-icon>
                <span>{{ openingGate() === gate.id ? 'Açılıyor...' : 'Kapıyı Aç' }}</span>
              </button>
            </div>
          </div>
        } @empty {
          <div class="md:col-span-3 p-10 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 text-center">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3.5 shadow-xs">
              <mat-icon class="icon-size-7">nfc</mat-icon>
            </div>
            <h4 class="text-base font-bold text-slate-800 dark:text-white m-0">Henüz Tanımlı Turnike Bulunmuyor</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5 mb-5 max-w-md mx-auto">
              Salonunuzdaki fiziksel turnike ve kapı kontrol ünitelerini (Ters Tünel, MQTT veya WebSocket) bağlamak için 'Yeni Turnike Ekle' butonunu kullanın.
            </p>
            <button
              type="button"
              (click)="openAddGateDrawer()"
              class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <mat-icon class="icon-size-4">add</mat-icon>
              <span>Yeni Turnike Ekle</span>
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
              Turnikelerden geçen tüm üyelerin anlık onay ve red kayıtları.
            </p>
          </div>

          <!-- Quick Metrics Pills -->
          <div class="flex flex-wrap items-center gap-2">
            <!-- Perkotek YT-32 5s Live Sync Indicator -->
            <div class="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="font-bold">5s Canlı Dinleme</span>
              <button
                type="button"
                (click)="manualSyncFromDevice()"
                [disabled]="isSyncingDevice()"
                class="ml-0.5 p-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-all cursor-pointer text-indigo-600 dark:text-indigo-400 disabled:opacity-50"
                matTooltip="Perkotek YT-32 Cihazından Şimdi Veri Çek"
              >
                <mat-icon class="icon-size-3.5" [class.animate-spin]="isSyncingDevice()">sync</mat-icon>
              </button>
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
                        class="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                        [class.bg-emerald-50]="log.status === 'granted'"
                        [class.dark:bg-emerald-950/60]="log.status === 'granted'"
                        [class.text-emerald-700]="log.status === 'granted'"
                        [class.dark:text-emerald-300]="log.status === 'granted'"
                        [class.border]="true"
                        [class.border-emerald-200]="log.status === 'granted'"
                        [class.dark:border-emerald-800/60]="log.status === 'granted'"
                        [class.bg-rose-50]="log.status !== 'granted'"
                        [class.dark:bg-rose-950/60]="log.status !== 'granted'"
                        [class.text-rose-700]="log.status !== 'granted'"
                        [class.dark:text-rose-300]="log.status !== 'granted'"
                        [class.border-rose-200]="log.status !== 'granted'"
                        [class.dark:border-rose-800/60]="log.status !== 'granted'"
                      >
                        {{ log.status === 'granted' ? 'İzin Verildi' : 'Reddedildi' }}
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
        title="Yeni Turnike / Kapı Tanımla"
        submitLabel="Turnikeyi Kaydet"
        [submitting]="savingGate()"
        [errorMessage]="addGateError()"
        (closed)="closeAddGateDrawer()"
        (close)="closeAddGateDrawer()"
        (submitted)="saveNewGate()"
        (save)="saveNewGate()"
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
                <option value="Perkotek YT-32 Yüz & Kart">Perkotek YT-32 Yüz & Kart Terminali (TCP 4370)</option>
                <option value="Dinamik QR + NFC Mifare">Dinamik QR + NFC Mifare</option>
                <option value="Dinamik QR Okuyucu">Dinamik QR Okuyucu</option>
                <option value="Dinamik QR + Optik Sensör">Dinamik QR + Optik Sensör</option>
                <option value="Yüz Tanıma Terminali">Yüz Tanıma Terminali (IP / Standalone)</option>
                <option value="Mifare 13.56MHz RFID">Mifare 13.56MHz RFID</option>
              </select>
            </div>
          </div>

          <!-- Connection Protocol Selector -->
          <div class="pt-2">
            <label class="odv-label required">Bağlantı Altyapısı (Protokol)</label>
            <div class="grid grid-cols-1 gap-2.5 mt-1.5">
              <!-- Reverse Tunnel Option -->
              <label
                (click)="setProtocol('reverse_tunnel')"
                class="p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3"
                [class.border-indigo-600]="newGate.connectionProtocol === 'reverse_tunnel'"
                [class.bg-indigo-50/40]="newGate.connectionProtocol === 'reverse_tunnel'"
                [class.dark:bg-indigo-950/30]="newGate.connectionProtocol === 'reverse_tunnel'"
                [class.border-slate-200]="newGate.connectionProtocol !== 'reverse_tunnel'"
                [class.dark:border-slate-800]="newGate.connectionProtocol !== 'reverse_tunnel'"
              >
                <input
                  type="radio"
                  name="protocol"
                  value="reverse_tunnel"
                  [checked]="newGate.connectionProtocol === 'reverse_tunnel'"
                  class="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div class="flex items-center gap-1.5">
                    <mat-icon class="icon-size-4 text-purple-600 dark:text-purple-400">vpn_lock</mat-icon>
                    <span class="text-xs font-bold text-slate-900 dark:text-white">Ters Yönlü Tünel (Reverse Tunnel)</span>
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 mb-0">
                    Statik IP gerektirmeden, yerel ağdaki turnikeyi güvenli SSH/TLS ters tüneli ile bulut sunucuya bağlar.
                  </p>
                </div>
              </label>

              <!-- MQTT Option -->
              <label
                (click)="setProtocol('mqtt')"
                class="p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3"
                [class.border-indigo-600]="newGate.connectionProtocol === 'mqtt'"
                [class.bg-indigo-50/40]="newGate.connectionProtocol === 'mqtt'"
                [class.dark:bg-indigo-950/30]="newGate.connectionProtocol === 'mqtt'"
                [class.border-slate-200]="newGate.connectionProtocol !== 'mqtt'"
                [class.dark:border-slate-800]="newGate.connectionProtocol !== 'mqtt'"
              >
                <input
                  type="radio"
                  name="protocol"
                  value="mqtt"
                  [checked]="newGate.connectionProtocol === 'mqtt'"
                  class="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div class="flex items-center gap-1.5">
                    <mat-icon class="icon-size-4 text-sky-600 dark:text-sky-400">sensors</mat-icon>
                    <span class="text-xs font-bold text-slate-900 dark:text-white">MQTT IoT Broker</span>
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 mb-0">
                    Düşük gecikmeli IoT publish/subscribe mesajlaşma mimarisiyle turnike aç/kapa komutları iletilir.
                  </p>
                </div>
              </label>

              <!-- WebSocket Option -->
              <label
                (click)="setProtocol('websocket')"
                class="p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3"
                [class.border-indigo-600]="newGate.connectionProtocol === 'websocket'"
                [class.bg-indigo-50/40]="newGate.connectionProtocol === 'websocket'"
                [class.dark:bg-indigo-950/30]="newGate.connectionProtocol === 'websocket'"
                [class.border-slate-200]="newGate.connectionProtocol !== 'websocket'"
                [class.dark:border-slate-800]="newGate.connectionProtocol !== 'websocket'"
              >
                <input
                  type="radio"
                  name="protocol"
                  value="websocket"
                  [checked]="newGate.connectionProtocol === 'websocket'"
                  class="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div class="flex items-center gap-1.5">
                    <mat-icon class="icon-size-4 text-emerald-600 dark:text-emerald-400">wifi_tethering</mat-icon>
                    <span class="text-xs font-bold text-slate-900 dark:text-white">WebSocket Ters Tünel (WSS Gateway)</span>
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 mb-0">
                    Çift yönlü canlı TCP soket hattı ve ters tünel ile turnike tetiklemeleri ve kart okutma anında ekrana düşer.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <!-- Protocol Specific Inputs -->
          <div>
            <label class="odv-label required">
              {{ newGate.connectionProtocol === 'reverse_tunnel' ? 'Ters Tünel Uç Noktası (Tunnel Host / URI)' : newGate.connectionProtocol === 'mqtt' ? 'MQTT Broker Adresi (Broker Host)' : 'WebSocket Uç Noktası (WSS URL)' }}
            </label>
            <input
              type="text"
              [(ngModel)]="newGate.endpoint"
              [placeholder]="newGate.connectionProtocol === 'reverse_tunnel' ? 'edge-tunnel://gate01.internal-mesh:2201' : newGate.connectionProtocol === 'mqtt' ? 'mqtt://broker.odivon.com:1883' : 'wss://turnstile-gateway.odivon.com/ws/gate-01'"
              class="odv-input font-mono text-xs"
            />
          </div>

          @if (newGate.connectionProtocol === 'mqtt') {
            <div>
              <label class="odv-label">MQTT Konu / Kanal (Topic)</label>
              <input
                type="text"
                [(ngModel)]="newGate.topicOrChannel"
                placeholder="Örn: odivon/gates/main-gate/events"
                class="odv-input font-mono text-xs"
              />
            </div>
          }

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="odv-label">Port</label>
              <input
                type="number"
                [(ngModel)]="newGate.port"
                [placeholder]="newGate.connectionProtocol === 'mqtt' ? '1883' : '8080'"
                class="odv-input font-mono text-xs"
              />
            </div>
            <div>
              <label class="odv-label">Yetki / Gizli Anahtar (Opsiyonel)</label>
              <input
                type="password"
                [(ngModel)]="newGate.secretToken"
                placeholder="••••••••"
                class="odv-input font-mono text-xs"
              />
            </div>
          </div>
        </div>
      </app-slide-over>

      <!-- 6. Edge Agent & Donanım Kurulum Sihirbazı Modalı -->
      @if (showAgentWizard()) {
        <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 font-sans animate-in fade-in duration-200">
          <div class="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <!-- Modal Header -->
            <div class="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
              <div class="flex items-center gap-3.5">
                <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                  <mat-icon class="icon-size-6">developer_board</mat-icon>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white m-0">
                      Perkotek & Donanım Edge Agent Kurulumu
                    </h3>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                      v1.0.0
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-0">
                    Yerel ağdaki Perkotek YT-32 turnike cihazınız ile bulut sistemini 5 saniyede bir senkronize edin.
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

            <!-- Tab Navigation Bar -->
            <div class="flex items-center gap-2 px-6 pt-3 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <button
                type="button"
                (click)="wizardTab.set('quick')"
                class="px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer"
                [class.border-indigo-600]="wizardTab() === 'quick'"
                [class.text-indigo-600]="wizardTab() === 'quick'"
                [class.dark:text-indigo-400]="wizardTab() === 'quick'"
                [class.border-transparent]="wizardTab() !== 'quick'"
                [class.text-slate-500]="wizardTab() !== 'quick'"
                [class.hover:text-slate-800]="wizardTab() !== 'quick'"
              >
                <mat-icon class="icon-size-4">rocket_launch</mat-icon>
                <span>Hızlı Kurulum & config.json</span>
              </button>

              <button
                type="button"
                (click)="wizardTab.set('test')"
                class="px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer"
                [class.border-indigo-600]="wizardTab() === 'test'"
                [class.text-indigo-600]="wizardTab() === 'test'"
                [class.dark:text-indigo-400]="wizardTab() === 'test'"
                [class.border-transparent]="wizardTab() !== 'test'"
                [class.text-slate-500]="wizardTab() !== 'test'"
                [class.hover:text-slate-800]="wizardTab() !== 'test'"
              >
                <mat-icon class="icon-size-4">bolt</mat-icon>
                <span>Canlı Donanım & Röle Testi</span>
              </button>

              <button
                type="button"
                (click)="wizardTab.set('guide')"
                class="px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer"
                [class.border-indigo-600]="wizardTab() === 'guide'"
                [class.text-indigo-600]="wizardTab() === 'guide'"
                [class.dark:text-indigo-400]="wizardTab() === 'guide'"
                [class.border-transparent]="wizardTab() !== 'guide'"
                [class.text-slate-500]="wizardTab() !== 'guide'"
                [class.hover:text-slate-800]="wizardTab() !== 'guide'"
              >
                <mat-icon class="icon-size-4">menu_book</mat-icon>
                <span>Adım Adım Kılavuz (.md)</span>
              </button>
            </div>

            <!-- Tab Contents (Scrollable Body) -->
            <div class="p-6 overflow-y-auto space-y-6">
              @if (wizardTab() === 'quick') {
                <!-- 1. Ajan Paketini İndir Hero Banner -->
                <div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
                  <div class="flex items-center gap-3.5">
                    <div class="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                      <mat-icon class="text-2xl">folder_zip</mat-icon>
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-extrabold text-sm sm:text-base block">Odivon Perkotek Edge Agent Paketi (Windows / Linux)</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">.ZIP</span>
                      </div>
                      <span class="text-xs text-slate-300 mt-0.5 block">
                        Kurulum dosyaları, başlatıcı bat dosyası ve hazır köprü kodlarını içeren temiz paket.
                      </span>
                    </div>
                  </div>

                  <a
                    href="/downloads/odivon-perkotek-edge-agent.zip"
                    download="odivon-perkotek-edge-agent.zip"
                    class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/30 transition-all whitespace-nowrap self-start sm:self-auto cursor-pointer no-underline flex items-center gap-2"
                  >
                    <mat-icon class="icon-size-4">download</mat-icon>
                    <span>Ajan Paketini İndir (.ZIP)</span>
                  </a>
                </div>

                <!-- Salon Kimliği Bilgi Şeridi -->
                <div class="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span class="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
                      Salonunuza Özel Kimlik (Tenant ID)
                    </span>
                    <span class="font-mono text-sm font-black text-slate-900 dark:text-white select-all">
                      {{ currentTenantId() }}
                    </span>
                  </div>
                  <span class="text-[11px] text-slate-500 dark:text-slate-400">
                    Ajan bu kimlik üzerinden salonunuza ait geçiş kuyruğunu eşler.
                  </span>
                </div>

                <!-- 3 Adımda Kurulum Akışı -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <!-- Adım 1 -->
                  <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col justify-between space-y-3">
                    <div class="space-y-2">
                      <div class="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-wider">
                        <span class="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-[11px]">1</span>
                        <span>Cihaz IP'si Verin</span>
                      </div>
                      <p class="text-xs text-slate-600 dark:text-slate-300 m-0">
                        Perkotek YT-32 cihazında <b>M/OK > İletişim > Ağ</b> menüsünden sabit IP atayın.
                      </p>
                    </div>
                    <div class="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 font-mono text-xs text-slate-700 dark:text-slate-200 text-center">
                      IP: {{ wizardDeviceIp() }} : 4370
                    </div>
                  </div>

                  <!-- Adım 2 -->
                  <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col justify-between space-y-3">
                    <div class="space-y-2">
                      <div class="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-wider">
                        <span class="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-[11px]">2</span>
                        <span>Dosyaları Kopyalayın</span>
                      </div>
                      <p class="text-xs text-slate-600 dark:text-slate-300 m-0">
                        Firebase'den aldığınız <b>serviceAccountKey.json</b> dosyasını <b>edge-agent/</b> klasörüne yapıştırın.
                      </p>
                    </div>
                    <div class="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold text-xs text-center flex items-center justify-center gap-1.5">
                      <mat-icon class="icon-size-4">check_circle</mat-icon>
                      <span>serviceAccountKey.json Hazır</span>
                    </div>
                  </div>

                  <!-- Adım 3 -->
                  <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col justify-between space-y-3">
                    <div class="space-y-2">
                      <div class="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-wider">
                        <span class="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-[11px]">3</span>
                        <span>Ajanı Başlatın</span>
                      </div>
                      <p class="text-xs text-slate-600 dark:text-slate-300 m-0">
                        Resepsiyon PC'sinde <b>baslat.bat</b> dosyasına çift tıklayın veya terminalden çalıştırın.
                      </p>
                    </div>
                    <div class="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 font-mono text-xs text-slate-700 dark:text-slate-200 text-center">
                      baslat.bat ➜ Çift Tıkla
                    </div>
                  </div>
                </div>

                <!-- config.json Oluşturucu & İndirme Alanı -->
                <div class="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 class="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white m-0 flex items-center gap-1.5">
                        <mat-icon class="icon-size-4 text-indigo-600">settings</mat-icon>
                        <span>Hazır Yapılandırma Dosyası (config.json)</span>
                      </h4>
                      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-0">
                        Cihazınızın IP adresini girip tek tıkla hazır dosyanızı indirin veya kopyalayın.
                      </p>
                    </div>

                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        (click)="copyConfigJson()"
                        class="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <mat-icon class="icon-size-4">content_copy</mat-icon>
                        <span>Kopyala</span>
                      </button>
                      <button
                        type="button"
                        (click)="downloadConfigFile()"
                        class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <mat-icon class="icon-size-4">download</mat-icon>
                        <span>config.json İndir</span>
                      </button>
                    </div>
                  </div>

                  <!-- Parametre Girişleri -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        Perkotek Cihaz Yerel IP
                      </label>
                      <input
                        type="text"
                        [value]="wizardDeviceIp()"
                        (input)="wizardDeviceIp.set($any($event.target).value)"
                        placeholder="192.168.1.201"
                        class="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        Turnike / Kapı Adı
                      </label>
                      <input
                        type="text"
                        [value]="wizardGateName()"
                        (input)="wizardGateName.set($any($event.target).value)"
                        placeholder="Turnike 1 - Ana Giriş"
                        class="w-full px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <!-- JSON Önizleme -->
                  <div class="relative rounded-xl overflow-hidden bg-slate-950 text-slate-200 p-4 font-mono text-xs border border-slate-800 max-h-48 overflow-y-auto">
                    <pre class="m-0 leading-relaxed">{{ getGeneratedConfigJson() }}</pre>
                  </div>
                </div>
              }

              @if (wizardTab() === 'test') {
                <div class="space-y-4">
                  <div class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-3">
                    <mat-icon class="icon-size-5 shrink-0">info</mat-icon>
                    <span>
                      Bu test komutları buluttan <b>device_commands</b> kuyruğuna yazılır. Resepsiyon bilgisayarındaki Edge Agent komutu anında okur ve Perkotek donanımına iletir.
                    </span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <!-- Test 1: Log Senkronizasyonu -->
                    <div class="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 flex flex-col justify-between">
                      <div>
                        <div class="flex items-center gap-2">
                          <mat-icon class="text-indigo-600">sync</mat-icon>
                          <h4 class="text-sm font-bold text-slate-900 dark:text-white m-0">Canlı Geçişleri Çek</h4>
                        </div>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-0">
                          Perkotek YT-32 cihazında biriken yeni kart/yüz geçişlerini 5 saniyelik periyodu beklemeden hemen OdivonGYM'e çeker.
                        </p>
                      </div>

                      <button
                        type="button"
                        (click)="wizardTriggerSync()"
                        [disabled]="testingSync()"
                        class="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 transition-all"
                      >
                        <mat-icon class="icon-size-4" [class.animate-spin]="testingSync()">refresh</mat-icon>
                        <span>{{ testingSync() ? 'Çekim Emri Gönderiliyor…' : 'Hemen Logları Çek (Sync Now)' }}</span>
                      </button>
                    </div>

                    <!-- Test 2: Turnike Röle Açma -->
                    <div class="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 flex flex-col justify-between">
                      <div>
                        <div class="flex items-center gap-2">
                          <mat-icon class="text-emerald-600">lock_open</mat-icon>
                          <h4 class="text-sm font-bold text-slate-900 dark:text-white m-0">Turnikeyi Aç (Röle Testi)</h4>
                        </div>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-0">
                          Perkotek cihazının kuru kontak rölesini 4 saniye boyunca tetikleyerek turnikenin serbest dönmesini sağlar.
                        </p>
                      </div>

                      <button
                        type="button"
                        (click)="wizardTriggerUnlock()"
                        [disabled]="testingUnlock()"
                        class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 transition-all"
                      >
                        <mat-icon class="icon-size-4" [class.animate-spin]="testingUnlock()">lock_open</mat-icon>
                        <span>{{ testingUnlock() ? 'Kapı Açılıyor…' : 'Turnikeyi Aç (4 sn Serbest Bırak)' }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              }

              @if (wizardTab() === 'guide') {
                <div class="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                    <h4 class="text-sm font-bold text-slate-900 dark:text-white m-0 flex items-center gap-1.5">
                      <mat-icon class="icon-size-4 text-indigo-600">terminal</mat-icon>
                      <span>7/24 Kesintisiz Windows Servisi Yapma (PM2)</span>
                    </h4>
                    <p class="m-0">
                      Resepsiyon bilgisayarı yeniden başladığında ajan servisi otomatik çalışsın istiyorsanız terminalde şu 3 komutu çalıştırmanız yeterlidir:
                    </p>
                    <div class="p-3 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] space-y-1">
                      <div>npm install -g pm2 pm2-windows-startup</div>
                      <div>pm2-startup install</div>
                      <div>pm2 start agent.js --name "odivon-turnike"</div>
                      <div>pm2 save</div>
                    </div>
                  </div>

                  <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                    <h4 class="text-sm font-bold text-slate-900 dark:text-white m-0 flex items-center gap-1.5">
                      <mat-icon class="icon-size-4 text-indigo-600">security</mat-icon>
                      <span>Güvenlik Duvarı & Port 4370 İzni</span>
                    </h4>
                    <p class="m-0">
                      Perkotek ve ZKTeco cihazları varsayılan olarak <b>4370 TCP ve UDP</b> portlarını kullanır. Bilgisayarınızdan cihaza ping atılamıyorsa veya timeout alıyorsanız modemde ve Windows Defender Güvenlik Duvarı'nda Port 4370'e izin verildiğinden emin olun.
                    </p>
                  </div>
                </div>
              }
            </div>

            <!-- Modal Footer -->
            <div class="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3 shrink-0">
              <span class="text-xs text-slate-500 dark:text-slate-400">
                Ajan klasörü: <code class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[11px] font-mono">edge-agent/</code>
              </span>
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

  protected readonly currentTenantId = computed(
    () => this.auth.profile()?.tenantId || this.auth.profile()?.uid || 'SZy9Bm141T86bnG6hUn4',
  );

  // Agent Wizard State
  protected readonly showAgentWizard = signal(false);
  protected readonly wizardTab = signal<'quick' | 'test' | 'guide'>('quick');
  protected readonly wizardDeviceIp = signal('192.168.1.201');
  protected readonly wizardGateName = signal('Turnike 1 - Ana Giriş');
  protected readonly testingUnlock = signal(false);
  protected readonly testingSync = signal(false);

  openAgentWizard(): void {
    this.showAgentWizard.set(true);
  }

  closeAgentWizard(): void {
    this.showAgentWizard.set(false);
  }

  getGeneratedConfigJson(): string {
    return JSON.stringify(
      {
        tenantId: this.currentTenantId(),
        device: {
          ip: this.wizardDeviceIp(),
          port: 4370,
          timeout: 5000,
          inMemory: true,
          gateName: this.wizardGateName(),
          direction: 'in',
        },
        polling: {
          intervalSeconds: 5,
          stateFilePath: './state.json',
        },
        firebase: {
          serviceAccountKeyPath: './serviceAccountKey.json',
        },
      },
      null,
      2,
    );
  }

  downloadConfigFile(): void {
    const jsonStr = this.getGeneratedConfigJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    a.click();
    URL.revokeObjectURL(url);
    this.alertService.toastSuccess('config.json dosyanız salon kodunuzla birlikte indirildi.');
  }

  copyConfigJson(): void {
    navigator.clipboard.writeText(this.getGeneratedConfigJson());
    this.alertService.toastSuccess('Yapılandırma panoya kopyalandı.');
  }

  async wizardTriggerSync(): Promise<void> {
    this.testingSync.set(true);
    try {
      await this.accessService.requestDeviceSync();
      this.alertService.toastSuccess(
        'Canlı geçişleri çekme emri cihaza iletildi. Birkaç saniye içinde kayıtlar panele yansıyacak.',
      );
    } catch {
      this.alertService.toastError('Senkronizasyon emri iletilemedi.');
    } finally {
      setTimeout(() => this.testingSync.set(false), 1500);
    }
  }

  async wizardTriggerUnlock(): Promise<void> {
    this.testingUnlock.set(true);
    try {
      await this.accessService.manualGateOpen(this.wizardGateName(), 'Edge Agent Testi (Sihirbaz)');
      this.alertService.toastSuccess('Röle tetikleme emri gönderildi! Turnike 4 saniye serbest dönecek.');
    } catch {
      this.alertService.toastError('Kapı açma emri gönderilemedi.');
    } finally {
      setTimeout(() => this.testingUnlock.set(false), 2000);
    }
  }

  protected readonly gates = toSignal(this.accessService.watchGates(), { initialValue: [] });
  protected readonly members = toSignal(this.membersService.watchMembers(), { initialValue: [] });
  private readonly logs = toSignal(this.accessService.watchLogs(), { initialValue: [] });

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
  protected readonly isSyncingDevice = signal(false);

  protected async manualSyncFromDevice(): Promise<void> {
    this.isSyncingDevice.set(true);
    try {
      await this.accessService.requestDeviceSync();
      this.alertService.toastSuccess('Perkotek YT-32 cihazı ile canlı senkronizasyon tetiklendi.');
    } catch {
      this.alertService.toastError('Cihaz senkronizasyonu başlatılamadı.');
    } finally {
      setTimeout(() => this.isSyncingDevice.set(false), 1200);
    }
  }

  // Add Gate SlideOver state
  protected readonly isAddGateOpen = signal(false);
  protected readonly savingGate = signal(false);
  protected readonly addGateError = signal('');
  protected newGate: {
    name: string;
    location: string;
    direction: AccessDirection | 'both';
    readerType: string;
    connectionProtocol: TurnstileConnectionProtocol;
    endpoint: string;
    topicOrChannel: string;
    port: number | null;
    secretToken: string;
  } = {
    name: '',
    location: '',
    direction: 'in',
    readerType: 'Dinamik QR + NFC Mifare',
    connectionProtocol: 'websocket',
    endpoint: '',
    topicOrChannel: '',
    port: 8080,
    secretToken: '',
  };

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
    return this.logs().filter((l) => l.status !== 'granted' && this.getLogMillis(l.timestamp) >= startOfToday).length;
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
      list = list.filter((l) => l.status !== 'granted');
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

  protected getGateTodayPasses(gateName: string): number {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    return this.logs().filter((l) => l.gateName === gateName && this.getLogMillis(l.timestamp) >= startOfToday).length;
  }

  protected async openGateManually(gate: TurnstileGate): Promise<void> {
    if (this.saasSub.isExpired()) {
      void this.alertService.error(
        'SaaS Aboneliği Sona Erdi',
        'Salonunuzun SaaS lisansı sona erdiği için uzaktan turnike açma komutları kilitlenmiştir. Lütfen SaaS Paket & Lisans menüsünden paketinizi yenileyiniz.',
      );
      return;
    }
    const gateId = gate.id || gate.name;
    this.openingGate.set(gateId);
    try {
      await this.accessService.manualGateOpen(gate.name, 'Resepsiyon panelinden tek tuşla açıldı');
      this.alertService.toastSuccess(`${gate.name} kapısı başarıyla açıldı.`);
    } finally {
      setTimeout(() => this.openingGate.set(null), 1000);
    }
  }

  protected async deleteGate(gate: TurnstileGate): Promise<void> {
    if (!gate.id) return;
    const ok = await this.alertService.deleteConfirm(gate.name, 'Bu turnike erişim kontrol sisteminden kalıcı olarak silinecektir.');
    if (ok) {
      await this.accessService.deleteGate(gate.id);
      this.alertService.toastSuccess(`${gate.name} silindi.`);
    }
  }

  protected setProtocol(proto: TurnstileConnectionProtocol): void {
    this.newGate.connectionProtocol = proto;
    const gateNum = (this.gates().length + 1).toString().padStart(2, '0');
    if (proto === 'reverse_tunnel') {
      this.newGate.endpoint = `edge-tunnel://gate${gateNum}.internal-mesh:2201`;
      this.newGate.port = 2201;
      this.newGate.topicOrChannel = '';
    } else if (proto === 'mqtt') {
      this.newGate.endpoint = 'mqtt://broker.odivon.com:1883';
      this.newGate.port = 1883;
      this.newGate.topicOrChannel = `odivon/gates/gate-${gateNum}/events`;
    } else {
      this.newGate.endpoint = `wss://turnstile-gateway.odivon.com/ws/gate-${gateNum}`;
      this.newGate.port = 8080;
      this.newGate.topicOrChannel = '';
    }
  }

  protected openAddGateDrawer(): void {
    this.addGateError.set('');
    const gateNum = (this.gates().length + 1).toString().padStart(2, '0');
    this.newGate = {
      name: '',
      location: '',
      direction: 'in',
      readerType: 'Dinamik QR + NFC Mifare',
      connectionProtocol: 'websocket',
      endpoint: `wss://turnstile-gateway.odivon.com/ws/gate-${gateNum}`,
      topicOrChannel: '',
      port: 8080,
      secretToken: '',
    };
    this.isAddGateOpen.set(true);
  }

  protected closeAddGateDrawer(): void {
    this.isAddGateOpen.set(false);
    this.addGateError.set('');
  }

  protected async saveNewGate(): Promise<void> {
    this.addGateError.set('');
    if (!this.newGate.name.trim()) {
      const msg = 'Lütfen turnike / kapı adını giriniz.';
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
    if (!this.newGate.endpoint.trim()) {
      const msg = 'Lütfen bağlantı uç noktası (endpoint) adresini giriniz.';
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
        status: 'online',
        readerType: this.newGate.readerType,
        connectionProtocol: this.newGate.connectionProtocol,
        endpoint: this.newGate.endpoint.trim(),
        topicOrChannel: this.newGate.topicOrChannel?.trim() || '',
        port: this.newGate.port ? Number(this.newGate.port) : null,
        secretToken: this.newGate.secretToken?.trim() || null,
      });

      this.alertService.toastSuccess('Yeni turnike başarıyla kaydedildi.');
      this.isAddGateOpen.set(false);
    } catch (e: any) {
      const msg = e.message || 'Turnike kaydedilirken hata oluştu.';
      this.addGateError.set(msg);
      this.alertService.toastError(msg);
    } finally {
      this.savingGate.set(false);
    }
  }

  protected async triggerEmergencyUnlock(): Promise<void> {
    const ok = await this.alertService.actionConfirm(
      '🚨 Acil Durum / Tahliye Modu',
      'DİKKAT: Acil durum / tahliye modunda tüm turnikeler açık konuma getirilecek.<br><br>Bu işlemi onaylıyor musunuz?',
      'Turnikeleri Aç',
      'warning',
      true,
    );
    if (ok) {
      await this.accessService.manualGateOpen('Tüm Turnikeler', 'ACİL TAHLİYE / YANGIN ALARMI');
      this.alertService.toastSuccess('Tüm turnikeler acil durum modunda açıldı.');
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
