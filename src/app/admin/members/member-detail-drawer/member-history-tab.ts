import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { AuditApi, MemberHistoryEntry } from '../../../core/api/audit.api';
import { auditChangeRows, auditDisplay, AuditChangeRow } from '../../../core/api/audit-format';
import { toAppError } from '../../../shared/models/app-error.model';
import { formatDateTime } from '../../../shared/ui/ui-utils';

type HistoryFilter = 'all' | 'membership' | 'info' | 'money';

const FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'membership', label: 'Paket & üyelik' },
  { id: 'info', label: 'Bilgi düzenleme' },
  { id: 'money', label: 'Ödeme & borç' },
];

/** İsteğin özeti için gösterilen alanlar (paket adı, gün, tutar…). */
const REQUEST_FIELDS: Record<string, string> = {
  packageName: 'Paket',
  durationDays: 'Süre (gün)',
  freezeDays: 'Dondurma (gün)',
  reason: 'Neden',
  amount: 'Tutar',
  price: 'Fiyat',
  salePrice: 'Satış fiyatı',
  packagePrice: 'Satış fiyatı',
  paidAmount: 'Ödenen',
  paymentMethod: 'Ödeme yöntemi',
  installmentCount: 'Taksit',
  debtInstallments: 'Taksit',
  description: 'Açıklama',
  type: 'Tür',
};

const PAYMENT_METHODS: Record<string, string> = {
  cash: 'Nakit',
  card: 'Kart',
  credit_card: 'Kart',
  transfer: 'Havale/EFT',
  bank_transfer: 'Havale/EFT',
  wallet: 'Cüzdan',
  online: 'Online',
};

interface HistoryRow {
  id: string;
  at: string;
  label: string;
  actor: string;
  icon: string;
  tone: string;
  category: HistoryFilter;
  changes: AuditChangeRow[];
  facts: { label: string; value: string }[];
}

/**
 * Üye detayı → "Geçmiş" sekmesi: üyeye dokunan her işlem (bilgi düzenleme, paket satışı / yenileme /
 * dondurma / iptal, bitiş tarihi, cüzdan, borç ve online ödemeler, tavsiye ödülleri) kim, ne zaman,
 * eski → yeni değer olarak. Kaynak: sunucudaki değiştirilemez işlem kaydı.
 */
@Component({
  selector: 'app-member-history-tab',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 class="text-sm font-black text-slate-900 m-0">Üye Geçmişi</h4>
          <p class="text-xs text-slate-500 mt-0.5 mb-0">Kim, ne zaman, neyi değiştirdi. Kayıtlar değiştirilemez ve silinemez.</p>
        </div>
        <button type="button" (click)="reload()" [disabled]="loading()"
          class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer border-none self-start">
          <mat-icon class="icon-size-4">refresh</mat-icon>
          <span>Yenile</span>
        </button>
      </div>

      <div class="flex flex-wrap gap-1.5">
        @for (f of filters; track f.id) {
          <button type="button" (click)="filter.set(f.id)"
            class="px-3 py-1 rounded-full text-[11px] font-bold border cursor-pointer transition-colors"
            [class]="filter() === f.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'">
            {{ f.label }}
          </button>
        }
      </div>

      @if (error()) {
        <div class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{{ error() }}</div>
      } @else if (visible().length === 0) {
        <div class="p-8 text-center bg-white rounded-2xl border border-slate-200/80">
          <mat-icon class="icon-size-10 text-slate-300 mx-auto mb-2">history</mat-icon>
          <p class="text-sm font-bold text-slate-700 m-0">{{ loading() ? 'Yükleniyor…' : 'Bu üye için kayıt yok' }}</p>
          @if (!loading()) {
            <p class="text-xs text-slate-400 mt-1 mb-0">Üyede yapılan değişiklikler burada görünür.</p>
          }
        </div>
      } @else {
        <ol class="relative m-0 p-0 list-none border-l-2 border-slate-100 ml-4 space-y-3">
          @for (row of visible(); track row.id) {
            <li class="relative pl-6">
              <span class="absolute -left-[15px] top-2 w-7 h-7 rounded-full flex items-center justify-center ring-4 ring-white" [class]="row.tone">
                <mat-icon class="icon-size-4">{{ row.icon }}</mat-icon>
              </span>
              <div class="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p class="text-xs font-bold text-slate-800 m-0">{{ row.label }}</p>
                  <span class="text-[11px] text-slate-400 font-medium whitespace-nowrap">{{ row.at }}</span>
                </div>
                <p class="text-[11px] text-slate-500 m-0 mt-0.5">{{ row.actor }}</p>

                @if (row.facts.length > 0) {
                  <div class="flex flex-wrap gap-1.5 mt-2">
                    @for (fact of row.facts; track fact.label) {
                      <span class="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                        <b class="font-bold">{{ fact.label }}:</b> {{ fact.value }}
                      </span>
                    }
                  </div>
                }

                @if (row.changes.length > 0) {
                  <div class="mt-2 space-y-1">
                    @for (change of row.changes; track change.field) {
                      <div class="grid grid-cols-[minmax(90px,auto)_1fr] gap-x-2 text-[11px] items-start">
                        <span class="font-bold text-slate-500">{{ change.label }}</span>
                        <span class="min-w-0 break-words">
                          <span class="text-rose-600 line-through decoration-rose-300 line-clamp-2">{{ change.from }}</span>
                          <mat-icon class="icon-size-3 text-slate-400 align-middle">arrow_forward</mat-icon>
                          <span class="text-emerald-700 font-semibold line-clamp-3">{{ change.to }}</span>
                        </span>
                      </div>
                    }
                  </div>
                }
              </div>
            </li>
          }
        </ol>

        @if (nextBefore()) {
          <div class="text-center">
            <button type="button" (click)="loadMore()" [disabled]="loading()"
              class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer border-none">
              <mat-icon class="icon-size-4">expand_more</mat-icon>
              <span>{{ loading() ? 'Yükleniyor…' : 'Daha eski kayıtlar' }}</span>
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class MemberHistoryTab {
  private readonly api = inject(AuditApi);

  readonly memberId = input.required<string>();

  protected readonly filters = FILTERS;
  protected readonly filter = signal<HistoryFilter>('all');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly nextBefore = signal<string | null>(null);
  private readonly entries = signal<MemberHistoryEntry[]>([]);

  private readonly rows = computed(() => this.entries().map((entry) => toRow(entry, this.memberId())));
  protected readonly visible = computed(() => {
    const filter = this.filter();
    return filter === 'all' ? this.rows() : this.rows().filter((row) => row.category === filter);
  });

  constructor() {
    effect(() => {
      const id = this.memberId();
      untracked(() => {
        this.entries.set([]);
        this.nextBefore.set(null);
        if (id) void this.fetch(id, false);
      });
    });
  }

  protected reload(): void {
    void this.fetch(this.memberId(), false);
  }

  protected loadMore(): void {
    void this.fetch(this.memberId(), true);
  }

  private async fetch(memberId: string, append: boolean): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const page = await firstValueFrom(this.api.memberHistory(memberId, append ? (this.nextBefore() ?? undefined) : undefined));
      if (memberId !== this.memberId()) return;
      this.entries.set(append ? [...this.entries(), ...page.items] : page.items);
      this.nextBefore.set(page.nextBefore);
    } catch (err) {
      const error = toAppError(err);
      this.error.set(error.status === 403 ? 'Üye geçmişini görme yetkiniz yok.' : error.message || 'Üye geçmişi yüklenemedi.');
    } finally {
      this.loading.set(false);
    }
  }
}

function toRow(entry: MemberHistoryEntry, memberId: string): HistoryRow {
  const category = categoryOf(entry);
  const own = entry.entity === 'members' ? entry.changes : null;
  const fromOtherRoute = entry.memberChanges?.[memberId] ?? null;
  const changes = [...auditChangeRows(own), ...auditChangeRows(fromOtherRoute)];
  const referrer = isReferrerOf(entry, memberId);
  return {
    id: entry.id,
    at: formatDateTime(entry.createdAt),
    label: referrer ? 'Tavsiye ödülü (tavsiye ettiği üye kaydoldu)' : entry.label,
    actor: actorOf(entry),
    icon: ICONS[category],
    tone: TONES[entry.verb === 'delete' || /iptal/i.test(entry.label) ? 'danger' : category],
    category,
    changes,
    facts: entry.entity === 'members' && entry.verb === 'update' ? [] : factsOf(entry.request),
  };
}

const ICONS: Record<HistoryFilter, string> = {
  all: 'history',
  membership: 'card_membership',
  info: 'edit_note',
  money: 'payments',
};

const TONES: Record<HistoryFilter | 'danger', string> = {
  all: 'bg-slate-100 text-slate-600',
  membership: 'bg-indigo-50 text-indigo-600',
  info: 'bg-sky-50 text-sky-600',
  money: 'bg-emerald-50 text-emerald-600',
  danger: 'bg-rose-50 text-rose-600',
};

function categoryOf(entry: MemberHistoryEntry): HistoryFilter {
  const route = entry.route ?? '';
  if (/members\/:id\/(renew|freeze|cancel)|wallet\/purchase|membership\/renew|PAYMENT gym_member_package|POST \/gym\/members$/.test(route)) {
    return 'membership';
  }
  if (route.startsWith('PATCH /gym/members/:id') || route.startsWith('PATCH /gym/mobile/me')) return 'info';
  if (['wallet', 'receivables', 'payments', 'shop', 'accounting'].includes(entry.entity)) return 'money';
  return 'info';
}

function actorOf(entry: MemberHistoryEntry): string {
  if (entry.actorType === 'system') return 'Sistem · online ödeme (iyzico)';
  if (entry.actorType === 'member') return 'Üyenin kendisi · üye uygulaması';
  const role = entry.actorRole === 'owner' ? 'Salon sahibi' : entry.actorRole === 'admin' ? 'Yönetici' : 'Personel';
  return `${entry.actorEmail || 'Bilinmeyen kullanıcı'} · ${role}`;
}

function isReferrerOf(entry: MemberHistoryEntry, memberId: string): boolean {
  return entry.targetUserId !== memberId && (entry.route?.includes('/convert') || entry.route === 'POST /gym/referrals');
}

function factsOf(request: unknown): { label: string; value: string }[] {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return [];
  const record = request as Record<string, unknown>;
  const facts: { label: string; value: string }[] = [];
  const seen = new Set<string>();
  for (const [key, label] of Object.entries(REQUEST_FIELDS)) {
    const value = record[key];
    if (value === null || value === undefined || value === '' || seen.has(label)) continue;
    seen.add(label);
    const text = key === 'paymentMethod' ? (PAYMENT_METHODS[String(value)] ?? String(value)) : auditDisplay(value, key);
    facts.push({ label, value: text.length > 80 ? `${text.slice(0, 80)}…` : text });
  }
  return facts.slice(0, 6);
}
