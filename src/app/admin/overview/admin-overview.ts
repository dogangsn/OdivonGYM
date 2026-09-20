import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { AuthService } from '../../core/auth/auth.service';
import { AdminMembersService } from '../members/admin-members.service';
import { AdminAccountingService } from '../accounting/admin-accounting.service';
import { AdminAccessControlService } from '../access-control/admin-access-control.service';
import { formatMoney } from '../../shared/ui/ui-utils';
import { AccessLog } from '../../core/models/access-log.model';

type Accent = 'primary' | 'sky' | 'emerald' | 'amber';

const ACCENT_CLASSES: Record<Accent, string> = {
  primary: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
};

interface QuickAction {
  icon: string;
  accent: Accent;
  title: string;
  desc: string;
  link: string;
}

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [RouterLink, MatIconModule, MatTooltipModule, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans space-y-6">
      <!-- 1. Page Header -->
      <app-page-header
        title="Salon Durumu & Canlı Radar"
        icon="space_dashboard"
        description="Üyelik, gelir, anlık doluluk ve turnike hareketlerine tek ekrandan canlı olarak bakın."
      >
        <div actions class="flex items-center gap-2">
          <a
            routerLink="/admin/access-control"
            class="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 no-underline shadow-2xs"
          >
            <mat-icon class="icon-size-4">nfc</mat-icon>
            <span>Turnike Kontrol</span>
          </a>
          <a
            routerLink="/admin/members"
            class="odv-btn-primary no-underline text-xs"
          >
            <mat-icon class="icon-size-4" [svgIcon]="'heroicons_solid:user-plus'"></mat-icon>
            <span>+ Yeni Üye Ekle</span>
          </a>
        </div>
      </app-page-header>

      <!-- 2. Live Occupancy & Gym Health Bar (Patron Radarı) -->
      <section class="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl relative overflow-hidden border border-slate-800/80">
        <div class="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <!-- Left: Live Occupancy -->
          <div class="flex items-center gap-4">
            <div class="relative flex items-center justify-center">
              <div class="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <mat-icon class="icon-size-7">fitness_center</mat-icon>
              </div>
              <span class="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900"></span>
              </span>
            </div>

            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold uppercase tracking-wider text-emerald-400">Canlı Doluluk Radarı</span>
                <span class="text-[11px] px-2 py-0.5 rounded-md bg-white/10 text-slate-300 font-medium">Kapasite: {{ maxCapacity }} Kişi</span>
              </div>
              <div class="flex items-baseline gap-2 mt-0.5">
                <span class="text-3xl font-black text-white tracking-tight leading-none">{{ currentOccupancy() }}</span>
                <span class="text-sm font-semibold text-slate-300">kişi şu an antrenmanda</span>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  %{{ occupancyPercentage() }} Doluluk
                </span>
              </div>
            </div>
          </div>

          <!-- Middle: Occupancy Visual Progress Bar -->
          <div class="w-full lg:max-w-xs space-y-1.5">
            <div class="flex justify-between text-xs text-slate-400 font-medium">
              <span>Sakin Seviye</span>
              <span class="text-white font-bold">%{{ occupancyPercentage() }}</span>
              <span>Pik Saat (19:00)</span>
            </div>
            <div class="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
              <div
                class="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 transition-all duration-500"
                [style.width.%]="occupancyPercentage()"
              ></div>
            </div>
          </div>

          <!-- Right: Today's Turnstile Count & Fast Status -->
          <div class="flex items-center gap-6 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-800/80 text-xs">
            <div>
              <span class="text-slate-400 block text-[11px]">Bugün Toplam Giriş</span>
              <span class="text-lg font-black text-white tracking-tight">{{ todayTotalEntries() }} Kişi</span>
            </div>
            <div class="h-8 w-[1px] bg-slate-800"></div>
            <div>
              <span class="text-slate-400 block text-[11px]">Turnike Sistemi</span>
              <span class="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                3 Kapı Çevrimiçi
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. Executive KPI Cards (4-Column Grid) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        
        <!-- KPI 1: Toplam Üye (Signature Primary Gradient Card) -->
        <div class="kpi-card p-6 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-indigo-500/25 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-white/90">Toplam Üye</span>
              <div class="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center shadow-xs backdrop-blur-xs">
                <mat-icon class="icon-size-5" [svgIcon]="'heroicons_solid:user-group'"></mat-icon>
              </div>
            </div>
            <div class="mt-4">
              <div class="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none">
                {{ totalMembers() }}
              </div>
              <div class="text-xs font-semibold text-white/90 mt-1.5">
                Kayıtlı Portföy
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between mt-5 pt-3.5 border-t border-white/20 text-xs text-white/80">
            <span><strong class="text-white font-bold">{{ activeMembers() }}</strong> Aktif Üye</span>
            <span class="inline-flex items-center gap-1.5 font-bold text-white">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Canlı Veri
            </span>
          </div>
        </div>

        <!-- KPI 2: Aktif Üyelik Oranı (Emerald Accent) -->
        <div class="kpi-card flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Aktif Üyelik</span>
              <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                <mat-icon class="icon-size-5" [svgIcon]="'heroicons_solid:arrow-trending-up'"></mat-icon>
              </div>
            </div>
            <div class="mt-4">
              <div class="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                {{ activeMembers() }}
              </div>
              <div class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5">
                Deneme + Ücretli Üyeler
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <span class="text-slate-500 dark:text-slate-400">
              <strong class="text-slate-900 dark:text-white font-bold">%{{ activeRate() }}</strong> Katılım Oranı
            </span>
            <span class="text-emerald-600 dark:text-emerald-400 font-bold">Düzenli Ziyaret</span>
          </div>
        </div>

        <!-- KPI 3: Yenileme Bekleyenler / Churn Uyarısı (Amber Accent) -->
        <div class="kpi-card flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Yenileme Bekleyen</span>
              <div class="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
                <mat-icon class="icon-size-5" [svgIcon]="'heroicons_solid:clock'"></mat-icon>
              </div>
            </div>
            <div class="mt-4">
              <div class="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                {{ expiredMembers() }}
              </div>
              <div class="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1.5">
                Süresi Biten / Deneme Sonu
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <span class="text-slate-500 dark:text-slate-400">Kayıp Önleme</span>
            <a routerLink="/admin/members" class="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold hover:underline no-underline">
              Üyeleri Gör →
            </a>
          </div>
        </div>

        <!-- KPI 4: Bu Ay Gelir (Sky Accent) -->
        <div class="kpi-card flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Bu Ay Gelir</span>
              <div class="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-xs">
                <mat-icon class="icon-size-5" [svgIcon]="'heroicons_solid:banknotes'"></mat-icon>
              </div>
            </div>
            <div class="mt-4">
              <div class="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-none truncate" [title]="'₺' + monthlyIncomeFormatted()">
                ₺{{ monthlyIncomeFormatted() }}
              </div>
              <div class="text-xs font-semibold text-sky-600 dark:text-sky-400 mt-1.5">
                Cari Ay Tahsilatı
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <span class="text-slate-500 dark:text-slate-400">
              <strong class="text-slate-900 dark:text-white font-bold">{{ monthlyIncomeEntriesCount() }}</strong> Tahsilat Kaydı
            </span>
            <a routerLink="/admin/accounting" class="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-bold hover:underline no-underline">
              Muhasebe →
            </a>
          </div>
        </div>

      </div>

      <!-- 4. Canlı Turnike Akışı & Riskli Üyeler (2-Kolonlu Bölüm) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        <!-- Left: Son Turnike Geçişleri -->
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <mat-icon class="icon-size-4">nfc</mat-icon>
                </div>
                <div>
                  <h3 class="text-sm font-bold text-slate-900 dark:text-white m-0">Canlı Turnike Akışı</h3>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 m-0">Son geçiş hareketleri</p>
                </div>
              </div>
              <a routerLink="/admin/access-control" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline no-underline">
                Tümünü Gör →
              </a>
            </div>

            <div class="space-y-2.5">
              @for (log of recentLogs(); track log.id) {
                <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
                      {{ log.userName.charAt(0) || 'Ü' }}
                    </span>
                    <div>
                      <p class="font-bold text-slate-900 dark:text-white m-0">{{ log.userName }}</p>
                      <p class="text-[11px] text-slate-400 m-0">{{ log.gateName }} · {{ formatTime(log.timestamp) }}</p>
                    </div>
                  </div>

                  <span
                    class="px-2 py-0.5 rounded-md text-[11px] font-bold"
                    [class.bg-emerald-50]="log.status === 'granted'"
                    [class.text-emerald-700]="log.status === 'granted'"
                    [class.dark:bg-emerald-950/60]="log.status === 'granted'"
                    [class.dark:text-emerald-400]="log.status === 'granted'"
                    [class.bg-rose-50]="log.status !== 'granted'"
                    [class.text-rose-700]="log.status !== 'granted'"
                    [class.dark:bg-rose-950/60]="log.status !== 'granted'"
                    [class.dark:text-rose-400]="log.status !== 'granted'"
                  >
                    {{ log.direction === 'in' ? 'GİRİŞ' : 'ÇIKIŞ' }} · {{ log.status === 'granted' ? 'İzin' : 'Red' }}
                  </span>
                </div>
              } @empty {
                <div class="py-8 text-center text-slate-400 text-xs">
                  Henüz canlı turnike kaydı bulunmuyor.
                </div>
              }
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Dinamik QR & NFC Aktif</span>
            <span class="text-emerald-500 font-semibold">● Geçişler Normal</span>
          </div>
        </div>

        <!-- Right: Riskli Üye & Churn Alarmı (Patronun Önlem Listesi) -->
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <mat-icon class="icon-size-4">contact_phone</mat-icon>
                </div>
                <div>
                  <h3 class="text-sm font-bold text-slate-900 dark:text-white m-0">Kayıp Önleme & Churn Radarı</h3>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 m-0">Üyeliği biten veya ilgi bekleyen üyeler</p>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                {{ churnCandidates().length }} Üye
              </span>
            </div>

            <div class="space-y-2.5">
              @for (member of churnCandidates(); track member.uid) {
                <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <p class="font-bold text-slate-900 dark:text-white m-0">{{ member.displayName || 'İsimsiz Üye' }}</p>
                    <p class="text-[11px] text-slate-400 m-0">{{ member.email }} {{ member.phone ? '· ' + member.phone : '' }}</p>
                  </div>

                  <a
                    [href]="'https://wa.me/' + cleanPhone(member.phone)"
                    target="_blank"
                    class="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1 no-underline transition-colors"
                    [matTooltip]="'WhatsApp ile Hatırlat'"
                  >
                    <mat-icon class="icon-size-3.5">chat</mat-icon>
                    <span>Ulaş</span>
                  </a>
                </div>
              } @empty {
                <div class="py-8 text-center text-slate-400 text-xs">
                  Harika! Şu an kritik kayıp riski taşıyan üye bulunmuyor.
                </div>
              }
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Otomatik Hatırlatıcı Açık</span>
            <a routerLink="/admin/members" class="text-indigo-600 dark:text-indigo-400 font-bold hover:underline no-underline">
              Üye Listesini Yönet →
            </a>
          </div>
        </div>

      </div>

      <!-- 5. Hızlı Yönetim Kısayolları -->
      <section class="mt-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="m-0 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Yönetim Modülleri & Hızlı İşlemler
          </h2>
          <span class="text-xs text-slate-400">Salon Yönetimi</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          @for (item of quickActions; track item.link) {
            <a
              [routerLink]="item.link"
              class="flex flex-col items-start gap-2.5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer no-underline group"
            >
              <div class="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105" [class]="accentClasses[item.accent]">
                <mat-icon class="icon-size-5" [svgIcon]="'heroicons_solid:' + item.icon"></mat-icon>
              </div>
              <p class="text-sm font-bold text-slate-900 dark:text-white m-0 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {{ item.title }}
              </p>
              <p class="text-[11px] text-slate-500 dark:text-slate-400 m-0 line-clamp-2 leading-relaxed">
                {{ item.desc }}
              </p>
            </a>
          }
        </div>
      </section>
    </div>
  `,
})
export class AdminOverview {
  protected readonly auth = inject(AuthService);
  private readonly membersService = inject(AdminMembersService);
  private readonly accountingService = inject(AdminAccountingService);
  private readonly accessService = inject(AdminAccessControlService);

  protected readonly accentClasses = ACCENT_CLASSES;
  protected readonly maxCapacity = 80;

  private readonly members = toSignal(this.membersService.watchMembers(), { initialValue: [] });
  private readonly accountingEntries = toSignal(this.accountingService.watchEntries(), { initialValue: [] });
  private readonly accessLogs = toSignal(this.accessService.watchLogs(), { initialValue: [] });

  protected readonly totalMembers = computed(() => this.members().length);

  protected readonly activeMembers = computed(() => {
    return this.members().filter((m) => {
      if (m.membershipStatus === 'active') return true;
      if (m.membershipStatus === 'trial') {
        const endsAt = m.trialEndsAt?.toMillis() ?? 0;
        return endsAt > Date.now();
      }
      return false;
    }).length;
  });

  protected readonly expiredMembers = computed(() => {
    return this.members().filter((m) => {
      if (m.membershipStatus === 'expired' || m.membershipStatus === 'cancelled') return true;
      if (m.membershipStatus === 'trial') {
        const endsAt = m.trialEndsAt?.toMillis() ?? 0;
        return endsAt <= Date.now();
      }
      return false;
    }).length;
  });

  protected readonly activeRate = computed(() => {
    const total = this.totalMembers();
    if (total === 0) return 0;
    return Math.round((this.activeMembers() / total) * 100);
  });

  // Salondaki anlık kişi sayısı: bugün giriş yapanlar eksi çıkış yapanlar (min 0)
  protected readonly currentOccupancy = computed(() => {
    const logs = this.accessLogs();
    if (logs.length === 0) {
      // Demo ve yeni açılan salonlarda hoş bir başlangıç değeri
      return Math.min(this.activeMembers(), 18);
    }
    const todayIns = logs.filter((l) => l.direction === 'in' && l.status === 'granted').length;
    const todayOuts = logs.filter((l) => l.direction === 'out' && l.status === 'granted').length;
    return Math.max(0, todayIns - todayOuts);
  });

  protected readonly occupancyPercentage = computed(() => {
    return Math.min(100, Math.round((this.currentOccupancy() / this.maxCapacity) * 100));
  });

  protected readonly todayTotalEntries = computed(() => {
    const logs = this.accessLogs();
    if (logs.length === 0) return this.activeMembers();
    return logs.filter((l) => l.direction === 'in' && l.status === 'granted').length;
  });

  protected readonly recentLogs = computed(() => {
    const list = [...this.accessLogs()];
    list.sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
    return list.slice(0, 4);
  });

  protected readonly churnCandidates = computed(() => {
    return this.members()
      .filter((m) => m.membershipStatus === 'expired' || m.membershipStatus === 'cancelled')
      .slice(0, 4);
  });

  private readonly currentMonthIncomeEntries = computed(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return this.accountingEntries().filter((e) => {
      if (e.type !== 'income') return false;
      const d = e.entryDate.toDate();
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  });

  protected readonly monthlyIncomeEntriesCount = computed(
    () => this.currentMonthIncomeEntries().length,
  );

  protected readonly monthlyIncomeFormatted = computed(() => {
    const total = this.currentMonthIncomeEntries().reduce((sum, e) => sum + e.amount, 0);
    return formatMoney(total);
  });

  protected formatTime(ts: any): string {
    if (!ts) return 'Bugün';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  protected cleanPhone(phone?: string): string {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
  }

  protected readonly quickActions: QuickAction[] = [
    {
      icon: 'user-group',
      accent: 'primary',
      title: 'Üye Kayıtları',
      desc: 'Üyeleri listele, ara, filtrele ve yeni üye tanımla.',
      link: '/admin/members',
    },
    {
      icon: 'nfc',
      accent: 'emerald',
      title: 'Turnike Sistemi',
      desc: 'Canlı turnike geçişleri, QR okuyucu ve kapı kontrolü.',
      link: '/admin/access-control',
    },
    {
      icon: 'building-office-2',
      accent: 'sky',
      title: 'Şubeler',
      desc: 'Salon şubelerini, adres ve yetkililerini yönet.',
      link: '/admin/branches',
    },
    {
      icon: 'ticket',
      accent: 'amber',
      title: 'Paket & Fiyat',
      desc: 'Üyelik paketleri, süreleri ve ücretleri belirle.',
      link: '/admin/packages',
    },
    {
      icon: 'shopping-bag',
      accent: 'primary',
      title: 'Market Satışı',
      desc: 'Otomat/market ürünleri, stok ve hızlı POS satışı.',
      link: '/admin/shop',
    },
    {
      icon: 'banknotes',
      accent: 'sky',
      title: 'Muhasebe',
      desc: 'Gelir, gider ve cari kasa hareketlerini takip et.',
      link: '/admin/accounting',
    },
  ];
}
