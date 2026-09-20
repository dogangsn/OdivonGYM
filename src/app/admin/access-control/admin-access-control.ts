import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { AdminAccessControlService, GateScanResult } from './admin-access-control.service';
import { AdminMembersService } from '../members/admin-members.service';
import { AccessDirection, AccessLog, AccessMethod, AccessStatus } from '../../core/models/access-log.model';
import { UserProfile } from '../../core/models/user-profile.model';

interface TurnstileGate {
  id: string;
  name: string;
  location: string;
  direction: AccessDirection | 'both';
  status: 'online' | 'busy' | 'offline';
  readerType: string;
  ipAddress: string;
}

@Component({
  selector: 'app-admin-access-control',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule, PageHeader],
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
        </div>
      </app-page-header>

      <!-- 2. Turnstile Hardware Grid (3 Kapı Durumu) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        @for (gate of gates; track gate.id) {
          <div
            class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all hover:border-indigo-400/50"
          >
            <div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center"
                  >
                    <mat-icon class="icon-size-5">nfc</mat-icon>
                  </div>
                  <div>
                    <h3 class="text-sm font-bold text-slate-900 dark:text-white m-0">{{ gate.name }}</h3>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 m-0">{{ gate.location }}</p>
                  </div>
                </div>
                <span
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Çevrimiçi
                </span>
              </div>

              <!-- Gate Stats -->
              <div class="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                <div>
                  <span class="text-[11px] text-slate-400 block">Okuyucu Tipi</span>
                  <span class="font-bold text-slate-800 dark:text-slate-200">{{ gate.readerType }}</span>
                </div>
                <div>
                  <span class="text-[11px] text-slate-400 block">IP / Protokol</span>
                  <span class="font-mono text-[11px] text-slate-600 dark:text-slate-300">{{ gate.ipAddress }}</span>
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
                @for (gate of gates; track gate.id) {
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
    </div>
  `,
})
export class AdminAccessControl {
  private readonly accessService = inject(AdminAccessControlService);
  private readonly membersService = inject(AdminMembersService);

  protected readonly gates: TurnstileGate[] = [
    {
      id: 'gate-1',
      name: 'Turnike 01 (Ana Giriş)',
      location: 'Giriş Holü - Turnike A',
      direction: 'in',
      status: 'online',
      readerType: 'Dinamik QR + NFC Mifare',
      ipAddress: '192.168.1.101 (Wiegand 34)',
    },
    {
      id: 'gate-2',
      name: 'Turnike 02 (Ana Çıkış)',
      location: 'Giriş Holü - Turnike B',
      direction: 'out',
      status: 'online',
      readerType: 'Dinamik QR + Optik Sensör',
      ipAddress: '192.168.1.102 (Wiegand 34)',
    },
    {
      id: 'gate-3',
      name: 'Turnike 03 (VIP / Studio)',
      location: '2. Kat Pilates & Reformer Alanı',
      direction: 'both',
      status: 'online',
      readerType: 'Dinamik QR Okuyucu',
      ipAddress: '192.168.1.105 (TCP/IP Relay)',
    },
  ];

  protected readonly members = toSignal(this.membersService.watchMembers(), { initialValue: [] });
  private readonly logs = toSignal(this.accessService.watchLogs(), { initialValue: [] });

  protected readonly logFilter = signal<'all' | 'granted' | 'denied'>('all');
  protected readonly openingGate = signal<string | null>(null);
  protected readonly scanning = signal(false);
  protected readonly lastResult = signal<GateScanResult | null>(null);

  protected selectedMemberUid = '';
  protected selectedGateName = 'Turnike 01 (Ana Giriş)';
  protected selectedDirection: AccessDirection = 'in';

  protected readonly filteredLogs = computed(() => {
    const list = [...this.logs()];
    // Sort descending by timestamp
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
    this.openingGate.set(gate.id);
    try {
      await this.accessService.manualGateOpen(gate.name, 'Resepsiyon panelinden tek tuşla açıldı');
    } finally {
      setTimeout(() => this.openingGate.set(null), 1000);
    }
  }

  protected async triggerEmergencyUnlock(): Promise<void> {
    if (confirm('DİKKAT: Acil durum / tahliye modunda tüm turnikeler açık konuma getirilecek. Onaylıyor musunuz?')) {
      await this.accessService.manualGateOpen('Tüm Turnikeler', 'ACİL TAHLİYE / YANGIN ALARMI');
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

  protected formatTimestamp(ts: any): string {
    if (!ts) return '—';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' · ' + date.toLocaleDateString('tr-TR');
  }
}
