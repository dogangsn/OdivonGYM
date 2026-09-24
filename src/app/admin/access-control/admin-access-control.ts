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
          <div class="md:col-span-3 p-8 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 text-center">
            <div class="w-12 h-12 mx-auto rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
              <mat-icon class="icon-size-6">nfc</mat-icon>
            </div>
            <h4 class="text-base font-bold text-slate-800 dark:text-white m-0">Henüz Tanımlı Turnike Bulunmuyor</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
              Salonunuzdaki fiziksel turnike ve kapı kontrol ünitelerini Ters Tünel, MQTT veya WebSocket altyapısıyla bağlayın.
            </p>
            <div class="flex items-center justify-center gap-3">
              <button
                type="button"
                (click)="seedDefaults()"
                class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                Varsayılan Turnikeleri Başlat
              </button>
              <button
                type="button"
                (click)="openAddGateDrawer()"
                class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Yeni Turnike Ekle
              </button>
            </div>
          </div>
        }
      </div>

      <!-- 3. Interaktif Turnike & Dinamik QR Geçiş Testi Simülatörü -->
      <section class="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div class="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div class="relative z-10">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30 mb-2">
                <mat-icon class="icon-size-3.5">qr_code_scanner</mat-icon>
                <span>Canlı Turnike Simülatörü</span>
              </div>
              <h2 class="text-lg sm:text-xl font-black text-white tracking-tight m-0">
                Resepsiyon Hızlı Geçiş Doğrulama (QR & Kart)
              </h2>
              <p class="text-xs sm:text-sm text-slate-300 font-normal mt-1 mb-0">
                Üyenin QR kodunu veya e-postasını test ederek salon kuralı ve üyelik kontrollerini canlı deneyin.
              </p>
            </div>
          </div>

          <!-- Simulator Form Controls -->
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
            <!-- Member Select -->
            <div class="sm:col-span-5">
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Test Edilecek Üye
              </label>
              <select
                [(ngModel)]="selectedMemberUid"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">-- Üye Seçiniz --</option>
                @for (m of members(); track m.uid) {
                  <option [value]="m.uid">
                    {{ m.displayName || m.email }} ({{ m.membershipStatus | uppercase }})
                  </option>
                }
              </select>
            </div>

            <!-- Gate Select -->
            <div class="sm:col-span-3">
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Hedef Turnike
              </label>
              <select
                [(ngModel)]="selectedGateName"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                @for (gate of gates(); track gate.id || gate.name) {
                  <option [value]="gate.name">{{ gate.name }}</option>
                }
              </select>
            </div>

            <!-- Direction -->
            <div class="sm:col-span-2">
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Yön
              </label>
              <select
                [(ngModel)]="selectedDirection"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="in">Giriş (IN)</option>
                <option value="out">Çıkış (OUT)</option>
              </select>
            </div>

            <!-- Action Button -->
            <div class="sm:col-span-2">
              <button
                type="button"
                (click)="simulateScan()"
                [disabled]="!selectedMemberUid || scanning()"
                class="w-full py-2.5 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <mat-icon class="icon-size-4">{{ scanning() ? 'sync' : 'play_arrow' }}</mat-icon>
                <span>{{ scanning() ? 'Taranıyor...' : 'Geçişi Test Et' }}</span>
              </button>
            </div>
          </div>

          <!-- Canlı USB / El Tipi Barkod Okuyucu Girişi -->
          <div class="mt-4 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-3">
            <div class="relative flex-1 w-full">
              <input
                type="text"
                placeholder="Fiziksel USB Barkod/QR Okuyucu ile Okutun veya Kodu Yapıştırın (Enter tuşuna basın)…"
                class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs sm:text-sm font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                [(ngModel)]="barcodeInput"
                (keydown.enter)="onBarcodeScanned()"
              />
              <mat-icon class="icon-size-4.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">qr_code_scanner</mat-icon>
            </div>
            <button
              type="button"
              (click)="onBarcodeScanned()"
              [disabled]="!barcodeInput.trim() || scanning()"
              class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <mat-icon class="icon-size-4">bolt</mat-icon>
              <span>Barkodu Okut / Doğrula</span>
            </button>
          </div>

          <!-- Last Scan Result Feedback Banner -->
          @if (lastResult(); as res) {
            <div
              class="mt-5 p-4 rounded-xl border backdrop-blur-md flex items-center gap-4 transition-all"
              [class.bg-emerald-950/70]="res.allowed"
              [class.border-emerald-500/50]="res.allowed"
              [class.text-emerald-200]="res.allowed"
              [class.bg-rose-950/70]="!res.allowed"
              [class.border-rose-500/50]="!res.allowed"
              [class.text-rose-200]="!res.allowed"
            >
              <div
                class="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                [class.bg-emerald-600]="res.allowed"
                [class.bg-rose-600]="!res.allowed"
              >
                <mat-icon class="icon-size-6">{{ res.allowed ? 'check_circle' : 'cancel' }}</mat-icon>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                    [class.bg-emerald-500/30]="res.allowed"
                    [class.bg-rose-500/30]="!res.allowed"
                  >
                    {{ res.allowed ? 'GEÇİŞ İZNİ VERİLDİ' : 'GEÇİŞ ENGELLENDİ' }}
                  </span>
                  <span class="text-xs opacity-75">{{ res.gateName }}</span>
                </div>
                <p class="text-sm font-bold text-white mt-1 m-0">{{ res.userName }}: {{ res.message }}</p>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- 4. Canlı Turnike Geçiş Kayıtları Tablosu (Real-time Access Logs) -->
      <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div class="p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-black text-slate-900 dark:text-white tracking-tight m-0">
              Canlı Geçiş Kayıtları (Access Stream)
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-0">
              Turnikelerden geçen tüm üyelerin anlık onay ve red kayıtları.
            </p>
          </div>

          <!-- Filter Tabs -->
          <div class="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
            <button
              type="button"
              (click)="logFilter.set('all')"
              class="px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              [class.bg-white]="logFilter() === 'all'"
              [class.dark:bg-slate-700]="logFilter() === 'all'"
              [class.text-slate-900]="logFilter() === 'all'"
              [class.dark:text-white]="logFilter() === 'all'"
              [class.shadow-2xs]="logFilter() === 'all'"
              [class.text-slate-500]="logFilter() !== 'all'"
            >
              Tümü
            </button>
            <button
              type="button"
              (click)="logFilter.set('granted')"
              class="px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              [class.bg-white]="logFilter() === 'granted'"
              [class.dark:bg-slate-700]="logFilter() === 'granted'"
              [class.text-slate-900]="logFilter() === 'granted'"
              [class.dark:text-white]="logFilter() === 'granted'"
              [class.shadow-2xs]="logFilter() === 'granted'"
              [class.text-slate-500]="logFilter() !== 'granted'"
            >
              İzin Verilenler
            </button>
            <button
              type="button"
              (click)="logFilter.set('denied')"
              class="px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              [class.bg-white]="logFilter() === 'denied'"
              [class.dark:bg-slate-700]="logFilter() === 'denied'"
              [class.text-slate-900]="logFilter() === 'denied'"
              [class.dark:text-white]="logFilter() === 'denied'"
              [class.shadow-2xs]="logFilter() === 'denied'"
              [class.text-slate-500]="logFilter() !== 'denied'"
            >
              Reddedilenler
            </button>
          </div>
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
              @for (log of filteredLogs(); track log.id) {
                <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td class="py-3 px-5 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-xs">
                    {{ formatTimestamp(log.timestamp) }}
                  </td>
                  <td class="py-3 px-5">
                    <div class="flex items-center gap-2.5">
                      <span class="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {{ log.userName.charAt(0) || 'Ü' }}
                      </span>
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
                        <span class="text-xs text-slate-400">{{ log.notes }}</span>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="py-12 text-center text-slate-400 text-xs">
                    Henüz kayıtlı turnike geçiş hareketi bulunmuyor.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
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
                <option value="Dinamik QR + NFC Mifare">Dinamik QR + NFC Mifare</option>
                <option value="Dinamik QR Okuyucu">Dinamik QR Okuyucu</option>
                <option value="Dinamik QR + Optik Sensör">Dinamik QR + Optik Sensör</option>
                <option value="Yüz Tanıma Terminali">Yüz Tanıma Terminali</option>
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
    </div>
  `,
})
export class AdminAccessControl implements OnInit {
  private readonly accessService = inject(AdminAccessControlService);
  private readonly membersService = inject(AdminMembersService);
  private readonly alertService = inject(AlertService);
  protected readonly saasSub = inject(SaasSubscriptionService);

  protected readonly gates = toSignal(this.accessService.watchGates(), { initialValue: [] });
  protected readonly members = toSignal(this.membersService.watchMembers(), { initialValue: [] });
  private readonly logs = toSignal(this.accessService.watchLogs(), { initialValue: [] });

  protected readonly logFilter = signal<'all' | 'granted' | 'denied'>('all');
  protected readonly openingGate = signal<string | null>(null);
  protected readonly scanning = signal(false);
  protected readonly lastResult = signal<GateScanResult | null>(null);

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

  protected selectedMemberUid = '';
  protected selectedGateName = 'Turnike 01 (Ana Giriş)';
  protected selectedDirection: AccessDirection = 'in';

  ngOnInit(): void {
    // Seed default dynamic turnstiles if tenant has none
    this.accessService.seedDefaultGatesIfEmpty().catch(() => {});
  }

  protected readonly filteredLogs = computed(() => {
    const list = [...this.logs()];
    list.sort((a, b) => {
      const ta = a.timestamp?.toMillis?.() ?? 0;
      const tb = b.timestamp?.toMillis?.() ?? 0;
      return tb - ta;
    });

    const filter = this.logFilter();
    if (filter === 'all') return list;
    if (filter === 'granted') return list.filter((l) => l.status === 'granted');
    return list.filter((l) => l.status !== 'granted');
  });

  protected getGateTodayPasses(gateName: string): number {
    return this.logs().filter((l) => l.gateName === gateName).length;
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

  protected async seedDefaults(): Promise<void> {
    await this.accessService.seedDefaultGatesIfEmpty();
    this.alertService.toastSuccess('Varsayılan turnikeler başarıyla yüklendi.');
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

  protected async simulateScan(): Promise<void> {
    if (!this.selectedMemberUid) return;
    const member = this.members().find((m) => m.uid === this.selectedMemberUid);
    if (!member) return;

    this.scanning.set(true);
    try {
      const result = await this.accessService.processGateScan(
        member,
        this.selectedDirection,
        this.selectedGateName,
        'qr',
      );
      this.lastResult.set(result);
    } finally {
      this.scanning.set(false);
    }
  }

  protected barcodeInput = '';

  protected async onBarcodeScanned(): Promise<void> {
    const code = this.barcodeInput.trim();
    if (!code || this.scanning()) return;

    this.scanning.set(true);
    try {
      const result = await this.accessService.validateAndProcessDynamicQrToken(
        code,
        this.selectedDirection,
        this.selectedGateName,
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

  protected formatTimestamp(ts: any): string {
    if (!ts) return '—';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' · ' + date.toLocaleDateString('tr-TR');
  }
}
