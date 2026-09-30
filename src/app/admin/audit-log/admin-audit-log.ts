import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { AuditApi, GymAuditLog, GymAuditQuery } from '../../core/api/audit.api';
import { StaffMember } from '../../core/models/staff.model';
import { UserProfile } from '../../core/models/user-profile.model';
import { AlertService } from '../../core/services/alert.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { toAppError } from '../../shared/models/app-error.model';
import { formatDateTime } from '../../shared/ui/ui-utils';
import { AdminMembersService } from '../members/admin-members.service';
import { AdminStaffService } from '../staff/admin-staff.service';

const MODULES: { id: string; label: string }[] = [
  { id: 'members', label: 'Üyeler' },
  { id: 'wallet', label: 'Cüzdan' },
  { id: 'receivables', label: 'Taksit / borç' },
  { id: 'shop', label: 'Mağaza / POS' },
  { id: 'accounting', label: 'Muhasebe' },
  { id: 'packages', label: 'Paketler' },
  { id: 'staff', label: 'Personel' },
  { id: 'access', label: 'Turnike' },
  { id: 'einvoice', label: 'E-fatura' },
  { id: 'sms', label: 'SMS' },
  { id: 'campaigns', label: 'Kampanyalar' },
  { id: 'classes', label: 'Grup dersleri' },
  { id: 'appointments', label: 'PT randevuları' },
  { id: 'branches', label: 'Şubeler' },
  { id: 'info', label: 'Salon bilgileri' },
  { id: 'saas', label: 'SaaS abonelik' },
  { id: 'mobile', label: 'Üye uygulaması' },
];

const FIELD_LABELS: Record<string, string> = {
  displayName: 'Ad soyad',
  email: 'E-posta',
  phone: 'Telefon',
  nationalId: 'T.C. kimlik no',
  gender: 'Cinsiyet',
  birthDate: 'Doğum tarihi',
  membershipStatus: 'Üyelik durumu',
  membershipStartsAt: 'Üyelik başlangıcı',
  membershipEndsAt: 'Üyelik bitişi',
  packageLabel: 'Paket',
  packagePrice: 'Paket fiyatı',
  walletBalance: 'Cüzdan bakiyesi',
  memberNumber: 'Üye no',
  trainerId: 'Antrenör',
  trainerName: 'Antrenör',
  branchId: 'Şube',
  branchName: 'Şube',
  branchIds: 'Şubeler',
  branchNames: 'Şubeler',
  notes: 'Not',
  price: 'Fiyat',
  durationDays: 'Süre (gün)',
  status: 'Durum',
  stock: 'Stok',
  amount: 'Tutar',
  totalAmount: 'Toplam tutar',
  paidAmount: 'Ödenen',
  remainingAmount: 'Kalan borç',
  installments: 'Taksitler',
  payments: 'Ödemeler',
  role: 'Rol',
  title: 'Unvan',
  monthlySalary: 'Maaş',
  commissionRate: 'Prim oranı',
  isArchived: 'Arşivde',
  deletedAt: 'Silinme',
  rfidCardNumber: 'Kart no',
};

const VERB_CLASS: Record<GymAuditLog['verb'], string> = {
  create: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  update: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  delete: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  action: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
};

const VERB_LABEL: Record<GymAuditLog['verb'], string> = {
  create: 'Ekleme',
  update: 'Güncelleme',
  delete: 'Silme',
  action: 'İşlem',
};

@Component({
  selector: 'app-admin-audit-log',
  standalone: true,
  imports: [FormsModule, MatIconModule, MatTooltipModule, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans space-y-6">
      <app-page-header
        title="İşlem Kaydı"
        icon="history"
        description="Salonda kim, ne zaman, hangi kaydı değiştirdi. Kayıtlar değiştirilemez ve silinemez."
      >
        <div actions class="flex items-center gap-2">
          <button type="button" class="odv-btn-soft" (click)="search()" [disabled]="loading()">
            <mat-icon class="icon-size-4">refresh</mat-icon>
            <span>Yenile</span>
          </button>
        </div>
      </app-page-header>

      <div class="odv-card p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 items-end">
        <label class="block">
          <span class="text-[11px] font-bold text-slate-500">Başlangıç</span>
          <input class="odv-input mt-1 w-full" type="date" [ngModel]="fromDate()" (ngModelChange)="fromDate.set($event)" />
        </label>
        <label class="block">
          <span class="text-[11px] font-bold text-slate-500">Bitiş</span>
          <input class="odv-input mt-1 w-full" type="date" [ngModel]="toDate()" (ngModelChange)="toDate.set($event)" />
        </label>
        <label class="block">
          <span class="text-[11px] font-bold text-slate-500">Modül</span>
          <select class="odv-input mt-1 w-full" [ngModel]="entity()" (ngModelChange)="entity.set($event)">
            <option value="">Tümü</option>
            @for (m of modules; track m.id) { <option [value]="m.id">{{ m.label }}</option> }
          </select>
        </label>
        <label class="block">
          <span class="text-[11px] font-bold text-slate-500">İşlemi yapan</span>
          <select class="odv-input mt-1 w-full" [ngModel]="actorEmail()" (ngModelChange)="actorEmail.set($event)">
            <option value="">Herkes</option>
            @for (s of staffOptions(); track s.email) { <option [value]="s.email">{{ s.name }}</option> }
          </select>
        </label>
        <label class="block">
          <span class="text-[11px] font-bold text-slate-500">Sonuç</span>
          <select class="odv-input mt-1 w-full" [ngModel]="result()" (ngModelChange)="result.set($event)">
            <option value="">Tümü</option>
            <option value="success">Başarılı</option>
            <option value="error">Hatalı / reddedildi</option>
          </select>
        </label>
        <label class="block">
          <span class="text-[11px] font-bold text-slate-500">Ara</span>
          <input class="odv-input mt-1 w-full" type="search" placeholder="işlem, e-posta, kayıt no…"
                 [ngModel]="text()" (ngModelChange)="text.set($event)" (keyup.enter)="search()" />
        </label>
        <div class="col-span-2 md:col-span-3 xl:col-span-6 flex flex-wrap items-center gap-2">
          @if (memberFilter(); as m) {
            <span class="odv-badge bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              Üye: {{ m.name }}
              <button type="button" class="ml-1 border-none bg-transparent cursor-pointer text-indigo-700" (click)="clearMember()">✕</button>
            </span>
          }
          <button type="button" class="odv-btn-primary ml-auto" (click)="search()" [disabled]="loading()">
            <mat-icon class="icon-size-4">search</mat-icon>
            <span>Filtrele</span>
          </button>
        </div>
      </div>

      <div class="odv-card overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-slate-50 dark:bg-slate-800/60">
              <th class="odv-th text-left">Zaman</th>
              <th class="odv-th text-left">İşlemi yapan</th>
              <th class="odv-th text-left">İşlem</th>
              <th class="odv-th text-left">Üye / kayıt</th>
              <th class="odv-th text-center">Sonuç</th>
              <th class="odv-th"></th>
            </tr>
          </thead>
          <tbody>
            @for (log of logs(); track log.id) {
              <tr class="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 cursor-pointer" (click)="toggle(log.id)">
                <td class="odv-td whitespace-nowrap">{{ dateTime(log.createdAt) }}</td>
                <td class="odv-td">
                  <div class="font-bold text-slate-900 dark:text-white">{{ actorName(log) }}</div>
                  <div class="text-[11px] text-slate-400">{{ log.actorType === 'member' ? 'Üye' : roleLabel(log.actorRole) }} · {{ log.ip }}</div>
                </td>
                <td class="odv-td">
                  <span class="odv-badge mr-1" [class]="verbClass[log.verb]">{{ verbLabel[log.verb] }}</span>
                  <span class="font-semibold text-slate-800 dark:text-slate-100">{{ log.label }}</span>
                  <div class="text-[11px] text-slate-400">{{ log.moduleLabel }}</div>
                </td>
                <td class="odv-td">
                  @if (log.targetUserId) {
                    <button type="button" class="text-indigo-600 font-bold border-none bg-transparent cursor-pointer p-0"
                            (click)="filterMember(log.targetUserId); $event.stopPropagation()" matTooltip="Bu üyenin tüm işlemleri">
                      {{ memberName(log.targetUserId) }}
                    </button>
                  } @else {
                    <span class="text-xs text-slate-400 font-mono">{{ log.entityId || '—' }}</span>
                  }
                </td>
                <td class="odv-td text-center">
                  @if (log.result === 'success') {
                    <span class="odv-badge bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">Başarılı</span>
                  } @else {
                    <span class="odv-badge bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" [matTooltip]="log.errorMessage || ''">
                      Hata {{ log.statusCode }}
                    </span>
                  }
                </td>
                <td class="odv-td text-right">
                  <mat-icon class="icon-size-4.5 text-slate-400">{{ expanded() === log.id ? 'expand_less' : 'expand_more' }}</mat-icon>
                </td>
              </tr>
              @if (expanded() === log.id) {
                <tr class="bg-slate-50/60 dark:bg-slate-900/60">
                  <td colspan="6" class="p-4">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                      <div>
                        <p class="m-0 mb-2 font-black text-slate-700 dark:text-slate-200">Değişen alanlar</p>
                        @if (changeRows(log).length > 0) {
                          <table class="w-full">
                            <thead>
                              <tr>
                                <th class="odv-th text-left">Alan</th>
                                <th class="odv-th text-left">Önce</th>
                                <th class="odv-th text-left">Sonra</th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (row of changeRows(log); track row.field) {
                                <tr class="border-t border-slate-100 dark:border-slate-800 align-top">
                                  <td class="odv-td font-semibold">{{ row.label }}</td>
                                  <td class="odv-td text-rose-700 dark:text-rose-300 break-all">{{ row.from }}</td>
                                  <td class="odv-td text-emerald-700 dark:text-emerald-300 break-all">{{ row.to }}</td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        } @else {
                          <p class="m-0 text-slate-400">Alan bazında değişiklik yok (yeni kayıt, işlem ya da hata).</p>
                        }
                        @if (log.errorMessage) {
                          <p class="m-0 mt-3 text-rose-600"><b>{{ log.errorCode }}</b>: {{ log.errorMessage }}</p>
                        }
                      </div>
                      <div>
                        <p class="m-0 mb-2 font-black text-slate-700 dark:text-slate-200">Gönderilen veri</p>
                        <pre class="m-0 p-3 rounded-xl bg-slate-900 text-slate-100 overflow-x-auto max-h-72 text-[11px]">{{ pretty(log.request) }}</pre>
                        <p class="m-0 mt-2 text-[11px] text-slate-400 break-all">
                          {{ log.route }} · kayıt {{ log.entityId || '—' }} · {{ log.durationMs }} ms · {{ log.userAgent }}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              }
            } @empty {
              <tr><td class="odv-td text-center text-slate-400 py-10" colspan="6">{{ loading() ? 'Yükleniyor…' : 'Bu filtrelerle kayıt yok.' }}</td></tr>
            }
          </tbody>
        </table>
        @if (nextCursor()) {
          <div class="p-3 text-center border-t border-slate-100 dark:border-slate-800">
            <button type="button" class="odv-btn-soft" (click)="loadMore()" [disabled]="loading()">
              <mat-icon class="icon-size-4">expand_more</mat-icon>
              <span>Daha eski kayıtlar</span>
            </button>
          </div>
        }
      </div>
    </div>
  `,
})
export class AdminAuditLog {
  private readonly api = inject(AuditApi);
  private readonly alert = inject(AlertService);
  private readonly staffService = inject(AdminStaffService);
  private readonly membersService = inject(AdminMembersService);

  protected readonly dateTime = formatDateTime;
  protected readonly modules = MODULES;
  protected readonly verbClass = VERB_CLASS;
  protected readonly verbLabel = VERB_LABEL;

  private readonly staff = toSignal(this.staffService.watchStaff(), { initialValue: [] as StaffMember[] });
  private readonly members = toSignal(this.membersService.watchMembers(), { initialValue: [] as UserProfile[] });
  private readonly staffByEmail = computed(
    () => new Map(this.staff().map((s) => [s.email?.toLowerCase(), s.displayName] as const)),
  );
  private readonly memberById = computed(() => new Map(this.members().map((m) => [m.uid, m.displayName] as const)));

  protected readonly fromDate = signal(daysAgo(7));
  protected readonly toDate = signal(daysAgo(0));
  protected readonly entity = signal('');
  protected readonly actorEmail = signal('');
  protected readonly result = signal<'' | 'success' | 'error'>('');
  protected readonly text = signal('');
  private readonly targetUserId = signal('');

  protected readonly logs = signal<GymAuditLog[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly expanded = signal<string | null>(null);

  protected readonly staffOptions = computed(() =>
    this.staff()
      .filter((s) => s.email)
      .map((s) => ({ email: s.email.toLowerCase(), name: s.displayName }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr')),
  );
  protected readonly memberFilter = computed(() => {
    const id = this.targetUserId();
    return id ? { id, name: this.memberName(id) } : null;
  });

  constructor() {
    void this.search();
  }

  protected async search(): Promise<void> {
    this.expanded.set(null);
    await this.fetch(false);
  }

  protected async loadMore(): Promise<void> {
    await this.fetch(true);
  }

  private async fetch(append: boolean): Promise<void> {
    this.loading.set(true);
    try {
      const query: GymAuditQuery = {
        // Tarih kutuları yerel gün; sunucu UTC ISO bekler.
        from: this.fromDate() ? new Date(`${this.fromDate()}T00:00:00`).toISOString() : undefined,
        to: this.toDate() ? new Date(`${this.toDate()}T23:59:59.999`).toISOString() : undefined,
        entity: this.entity() || undefined,
        result: this.result() || undefined,
        targetUserId: this.targetUserId() || undefined,
        // Personel kartı ile oturum hesabı e-postayla eşleşir.
        actorEmail: this.actorEmail() || undefined,
        q: this.text().trim() || undefined,
        cursor: append ? (this.nextCursor() ?? undefined) : undefined,
      };
      const page = await firstValueFrom(this.api.list(query));
      this.logs.set(append ? [...this.logs(), ...page.items] : page.items);
      this.nextCursor.set(page.nextCursor);
    } catch (err) {
      const error = toAppError(err);
      this.alert.toastError(
        error.status === 403 ? 'İşlem kaydını görme yetkiniz yok.' : error.message || 'İşlem kaydı yüklenemedi.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected filterMember(userId: string): void {
    this.targetUserId.set(userId);
    void this.search();
  }

  protected clearMember(): void {
    this.targetUserId.set('');
    void this.search();
  }

  protected toggle(id: string): void {
    this.expanded.set(this.expanded() === id ? null : id);
  }

  protected actorName(log: GymAuditLog): string {
    if (log.actorType === 'member') return this.memberName(log.actorId);
    return this.staffByEmail().get(log.actorEmail?.toLowerCase()) ?? log.actorEmail;
  }

  protected memberName(userId: string): string {
    return this.memberById().get(userId) ?? `#${userId.slice(0, 6)}`;
  }

  protected roleLabel(role: string): string {
    return role === 'owner' ? 'Salon sahibi' : role === 'admin' ? 'Yönetici' : 'Personel';
  }

  protected changeRows(log: GymAuditLog) {
    return Object.entries(log.changes ?? {}).map(([field, change]) => ({
      field,
      label: FIELD_LABELS[field] ?? field,
      from: display(change.from),
      to: display(change.to),
    }));
  }

  protected pretty(value: unknown): string {
    return value === null || value === undefined ? '—' : JSON.stringify(value, null, 2);
  }
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
