import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Observable, firstValueFrom } from 'rxjs';
import { ClassesApi, ClassRoster } from '../../../core/api/classes.api';
import { ClassSchedule } from '../../../core/models/class-schedule.model';
import { UserProfile } from '../../../core/models/user-profile.model';
import { AlertService } from '../../../core/services/alert.service';
import { toAppError } from '../../../shared/models/app-error.model';

const STATUS_LABEL: Record<string, string> = {
  booked: 'Kayıtlı',
  'checked-in': 'Geldi',
  'no-show': 'Gelmedi',
  cancelled: 'İptal',
};

const ERRORS: Record<string, string> = {
  GYM_CLASS_FULL: 'Seans dolu; üyeyi bekleme listesine ekleyebilirsiniz.',
  GYM_CLASS_NO_CREDIT: 'Üyenin bu dönem için ders hakkı kalmamış.',
  GYM_WAITLIST_EXISTS: 'Üye zaten bu seansta ya da bekleme listesinde.',
  GYM_MEMBER_NOT_FOUND: 'Üye bulunamadı.',
};

/**
 * Yoklama ve bekleme listesi: haftalık dersin bir seansı. Kayıtlılar için "Geldi / Gelmedi",
 * seansa üye ekleme (dolu ise bekleme listesine), listeden yer açıldıkça sıradakini alma.
 */
@Component({
  selector: 'app-class-roster',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (schedule(); as sc) {
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50" (click)="closed.emit()"></div>
      <div class="font-sans fixed inset-y-0 right-0 max-w-2xl w-full bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col border-l border-slate-200 dark:border-slate-800">
        <div class="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h3 class="m-0 text-lg font-black text-slate-900 dark:text-white">{{ sc.name }} · Yoklama</h3>
            <p class="m-0 text-xs text-slate-500">
              {{ dayLabel(roster()?.sessionDate) }} {{ sc.startTime }}
              @if (roster(); as r) {
                · {{ activeCount() }} / {{ r.capacity || '∞' }} kişi
              }
            </p>
          </div>
          <div class="flex items-center gap-1">
            <button type="button" class="odv-icon-btn" (click)="shift(-7)" title="Önceki hafta"><mat-icon class="icon-size-5">chevron_left</mat-icon></button>
            <button type="button" class="odv-icon-btn" (click)="shift(7)" title="Sonraki hafta"><mat-icon class="icon-size-5">chevron_right</mat-icon></button>
            <button type="button" class="odv-icon-btn" (click)="closed.emit()" aria-label="Kapat"><mat-icon class="icon-size-5">close</mat-icon></button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-5 custom-scroll">
          @if (loading()) {
            <p class="m-0 text-xs text-slate-400">Yükleniyor…</p>
          } @else if (roster(); as r) {
            <section class="space-y-2">
              <div class="flex items-center justify-between">
                <h4 class="m-0 text-sm font-bold text-slate-800 dark:text-slate-100">Kayıtlılar</h4>
                @if (pastOrToday()) {
                  <button type="button" class="odv-btn-soft !py-1 !text-xs" [disabled]="busy()" (click)="markAll('checked-in')">Hepsi geldi</button>
                }
              </div>
              <table class="w-full text-sm">
                <tbody>
                  @for (b of r.bookings; track b.id) {
                    <tr class="border-t border-slate-100 dark:border-slate-800">
                      <td class="odv-td">
                        <div class="font-bold text-slate-900 dark:text-white">{{ b.memberName }}</div>
                        <div class="text-[11px] text-slate-400">
                          {{ statusLabel[b.attendanceStatus] }}
                          @if (b.lateCancel) { · geç iptal (hak düştü) }
                          @if (b.creditReserved) { · 1 ders hakkı kullanıldı }
                        </div>
                      </td>
                      <td class="odv-td text-right whitespace-nowrap">
                        @if (b.attendanceStatus !== 'cancelled') {
                          <button type="button" class="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer border-none mr-1"
                                  [class]="b.attendanceStatus === 'checked-in' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'"
                                  [disabled]="busy()" (click)="mark(b.id, 'checked-in')">Geldi</button>
                          <button type="button" class="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer border-none mr-1"
                                  [class]="b.attendanceStatus === 'no-show' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'"
                                  [disabled]="busy()" (click)="mark(b.id, 'no-show')">Gelmedi</button>
                          @if (b.attendanceStatus === 'booked') {
                            <button type="button" class="odv-icon-btn odv-icon-btn-danger" title="Kaydı iptal et (hak iade edilir)" [disabled]="busy()" (click)="cancel(b.id)">
                              <mat-icon class="icon-size-4">close</mat-icon>
                            </button>
                          }
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr><td class="odv-td text-center text-slate-400 py-6">Bu seansa kayıt yok.</td></tr>
                  }
                </tbody>
              </table>
            </section>

            <section class="space-y-2">
              <div class="flex items-center justify-between">
                <h4 class="m-0 text-sm font-bold text-slate-800 dark:text-slate-100">Bekleme listesi ({{ r.waitlist.length }})</h4>
                @if (r.waitlist.length && (r.free === null || r.free > 0)) {
                  <button type="button" class="odv-btn-soft !py-1 !text-xs" [disabled]="busy()" (click)="promote()">Boş yerlere sıradakileri al</button>
                }
              </div>
              @for (w of r.waitlist; track w.id) {
                <div class="flex items-center justify-between text-sm py-1.5 border-t border-slate-100 dark:border-slate-800">
                  <span><b class="text-slate-400 mr-2">{{ w.position }}.</b>{{ w.memberName }}</span>
                </div>
              } @empty {
                <p class="m-0 text-xs text-slate-400">Bekleyen yok. Kayıt iptal edilince sıradaki otomatik alınır.</p>
              }
            </section>

            <section class="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <h4 class="m-0 text-sm font-bold text-slate-800 dark:text-slate-100">Seansa üye ekle</h4>
              <div class="flex gap-2">
                <select class="odv-input flex-1" [ngModel]="memberToAdd()" (ngModelChange)="memberToAdd.set($event)">
                  <option value="">Üye seçin…</option>
                  @for (m of addable(); track m.uid) {
                    <option [value]="m.uid">{{ m.displayName }}</option>
                  }
                </select>
                <button type="button" class="odv-btn-primary" [disabled]="!memberToAdd() || busy()" (click)="add()">
                  {{ r.free === 0 ? 'Bekleme listesine ekle' : 'Seansa yaz' }}
                </button>
              </div>
              <p class="m-0 text-[11px] text-slate-400">
                Paketinde ders hakkı tanımlı üyelerden kayıtta 1 hak düşer; dersten en az 2 saat önce iptalde hak iade edilir.
              </p>
            </section>
          }
        </div>
      </div>
    }
  `,
})
export class ClassRosterPanel {
  private readonly api = inject(ClassesApi);
  private readonly alert = inject(AlertService);

  readonly schedule = input<ClassSchedule | null>(null);
  readonly members = input<UserProfile[]>([]);
  readonly closed = output<void>();

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly roster = signal<ClassRoster | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly memberToAdd = signal('');

  protected readonly activeCount = computed(
    () => (this.roster()?.bookings ?? []).filter((b) => b.attendanceStatus === 'booked' || b.attendanceStatus === 'checked-in').length,
  );
  protected readonly addable = computed(() => {
    const r = this.roster();
    const taken = new Set([...(r?.bookings ?? []).filter((b) => b.attendanceStatus !== 'cancelled').map((b) => b.userId), ...(r?.waitlist ?? []).map((w) => w.userId)]);
    return this.members()
      .filter((m) => !m.isArchived && !taken.has(m.uid))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'));
  });
  protected readonly pastOrToday = computed(() => {
    const date = this.roster()?.sessionDate;
    return !!date && date <= istanbulToday();
  });

  constructor() {
    effect(() => {
      const sc = this.schedule();
      if (sc) void this.load(sc.id);
    });
  }

  protected dayLabel(date: string | undefined): string {
    if (!date) return '';
    const [y, m, d] = date.split('-');
    const weekday = new Date(`${date}T12:00:00+03:00`).toLocaleDateString('tr-TR', { weekday: 'long', timeZone: 'Europe/Istanbul' });
    return `${d}.${m}.${y} ${weekday}`;
  }

  protected async shift(days: number): Promise<void> {
    const sc = this.schedule();
    const current = this.roster()?.sessionDate;
    if (!sc || !current) return;
    const next = new Date(Date.parse(`${current}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
    await this.load(sc.id, next);
  }

  protected async mark(bookingId: string, status: 'checked-in' | 'no-show'): Promise<void> {
    await this.run(() => this.api.attendance(this.schedule()!.id, this.roster()!.sessionDate, [{ bookingId, status }]));
  }

  protected async markAll(status: 'checked-in' | 'no-show'): Promise<void> {
    const entries = (this.roster()?.bookings ?? [])
      .filter((b) => b.attendanceStatus === 'booked')
      .map((b) => ({ bookingId: b.id, status }));
    if (!entries.length) return;
    await this.run(() => this.api.attendance(this.schedule()!.id, this.roster()!.sessionDate, entries));
  }

  protected async cancel(bookingId: string): Promise<void> {
    const ok = await this.alert.confirm({
      title: 'Kayıt iptal edilsin mi?',
      message: 'Ders hakkı iade edilir ve bekleme listesindeki sıradaki üye otomatik alınır.',
      icon: 'warning',
      confirmText: 'İptal et',
    });
    if (ok) await this.run(() => this.api.cancelBooking(this.schedule()!.id, bookingId));
  }

  protected async promote(): Promise<void> {
    await this.run(() => this.api.promoteWaitlist(this.schedule()!.id, this.roster()!.sessionDate));
  }

  protected async add(): Promise<void> {
    const userId = this.memberToAdd();
    const r = this.roster();
    if (!userId || !r) return;
    const full = r.free === 0;
    await this.run(() =>
      full ? this.api.joinWaitlist(r.scheduleId, userId, r.sessionDate) : this.api.bookMember(r.scheduleId, userId, r.sessionDate),
    );
    this.memberToAdd.set('');
  }

  private async run(action: () => Observable<unknown>): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(action());
      await this.load(this.schedule()!.id, this.roster()?.sessionDate);
    } catch (err) {
      const error = toAppError(err);
      this.alert.toastError(ERRORS[error.code] ?? (error.message || 'İşlem yapılamadı.'));
    } finally {
      this.busy.set(false);
    }
  }

  private async load(scheduleId: string, date?: string): Promise<void> {
    this.loading.set(!this.roster());
    try {
      this.roster.set(await firstValueFrom(this.api.roster(scheduleId, date)));
    } catch (err) {
      this.alert.toastError(toAppError(err).message || 'Yoklama yüklenemedi.');
    } finally {
      this.loading.set(false);
    }
  }
}

function istanbulToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
