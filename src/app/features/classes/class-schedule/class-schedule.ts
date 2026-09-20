import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth/auth.service';
import { ClassBooking, ClassSchedule as ScheduleModel } from '../../../core/models/class-schedule.model';
import { SportsDiscipline } from '../../../core/models/sports-discipline.model';
import { GymFacility } from '../../../core/models/gym-equipment.model';
import { MemberDocument } from '../../../core/models/member-document.model';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Field } from '../../../shared/ui/field';
import { SlideOver } from '../../../shared/ui/slide-over';
import { firstError } from '../../../shared/ui/ui-utils';
import { ClassesService } from '../classes.service';
import { AdminDisciplinesService } from '../../../admin/disciplines/admin-disciplines.service';
import { MemberDocumentsService } from '../../../core/services/member-documents.service';

type Day = ScheduleModel['dayOfWeek'];

const DAY_ORDER: Day[] = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABEL: Record<Day, string> = {
  0: 'Pazar',
  1: 'Pazartesi',
  2: 'Salı',
  3: 'Çarşamba',
  4: 'Perşembe',
  5: 'Cuma',
  6: 'Cumartesi',
};

const LEVEL_LABEL: Record<string, string> = {
  all: 'Tüm Seviyeler',
  beginner: 'Başlangıç',
  intermediate: 'Orta',
  advanced: 'İleri',
};

const STATUS_LABEL: Record<ScheduleModel['status'], string> = {
  active: 'Aktif',
  paused: 'Askıda',
  cancelled: 'İptal',
};

@Component({
  selector: 'app-class-schedule',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, PageHeader, SlideOver, Field],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans space-y-6 pb-20">
      <app-page-header
        title="Ders & Seans Takvimi"
        icon="calendar_month"
        description="Grup seanslarını, branş stüdyolarını ve antrenör eşliğindeki ders programlarını inceleyin."
      >
        @if (isAdmin()) {
          <button actions type="button" class="odv-btn-primary" (click)="openForm()">
            <mat-icon class="icon-size-4.5">add</mat-icon>
            Yeni Ders Tanımla
          </button>
        }
      </app-page-header>

      <!-- BİLGİLENDİRME / EVRAK UYARISI BANNERI -->
      <div class="odv-card p-4 bg-gradient-to-r from-indigo-50/70 via-sky-50/50 to-white border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
            <mat-icon class="icon-size-5">verified_user</mat-icon>
          </div>
          <div>
            <h4 class="m-0 text-sm font-bold text-slate-900">Sporcu Güvenliği & Evrak Takibi</h4>
            <p class="m-0 text-xs text-slate-600">
              Dövüş sporları (Kickboks, Boks) ve ileri seviye seanslar için güncel Sağlık Raporu veya Lisans belgenizin onaylanmış olması gerekmektedir.
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            Onaylı Evraklarım: {{ approvedDocsCount() }} Adet
          </span>
        </div>
      </div>

      @if (schedules() === null) {
        <div class="odv-card py-20 text-center">
          <mat-icon class="icon-size-8 text-slate-300 animate-spin">refresh</mat-icon>
          <p class="mt-2 text-sm text-slate-500 font-medium">Ders programı yükleniyor…</p>
        </div>
      } @else if (days().length === 0) {
        <div class="odv-card py-16 text-center max-w-lg mx-auto">
          <mat-icon class="icon-size-10 text-slate-300">event_busy</mat-icon>
          <h3 class="mt-3 text-base font-bold text-slate-800">Henüz Ders Tanımlanmamış</h3>
          <p class="text-xs text-slate-500 mt-1 mb-4">Şu an için aktif haftalık grup seansı bulunmamaktadır.</p>
          @if (isAdmin()) {
            <button type="button" class="odv-btn-primary" (click)="openForm()">
              <mat-icon class="icon-size-4">add</mat-icon>
              İlk Dersi Tanımla
            </button>
          }
        </div>
      } @else {
        <div class="space-y-6">
          @for (group of days(); track group.day) {
            <section class="space-y-3">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                <h3 class="m-0 text-sm font-bold uppercase tracking-wider text-slate-900">
                  {{ dayLabel[group.day] }}
                </h3>
                <span class="text-xs text-slate-400 font-semibold">({{ group.classes.length }} Seans)</span>
              </div>

              <div class="odv-card divide-y divide-slate-100 border border-slate-200/90 shadow-xs">
                @for (c of group.classes; track c.id) {
                  @let discipline = getDiscipline(c.disciplineId);
                  @let facility = getFacility(c.facilityId);

                  <div class="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                    <!-- Sol: Saat ve Seans Künyesi -->
                    <div class="flex items-start sm:items-center gap-4">
                      <!-- Saat Rozeti -->
                      <div class="w-24 flex-shrink-0 text-center bg-slate-100/80 border border-slate-200/80 p-2 rounded-xl">
                        <span class="block text-xs font-black text-slate-900 font-mono">{{ c.startTime }}</span>
                        <span class="block text-[10px] font-bold text-slate-400 font-mono">{{ c.endTime }}</span>
                      </div>

                      <!-- İsim ve Rozetler -->
                      <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap mb-1">
                          <h4 class="m-0 text-base font-bold text-slate-900">{{ c.name }}</h4>
                          
                          @if (discipline) {
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {{ discipline.name }}
                            </span>
                          }

                          @if (facility) {
                            <span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              📍 {{ facility.name }}
                            </span>
                          }

                          @if (c.requiredDocuments?.length) {
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                              <mat-icon class="icon-size-3">warning</mat-icon>
                              Evrak Şartı ({{ formatDocRequirements(c.requiredDocuments!) }})
                            </span>
                          }

                          @if (c.status !== 'active') {
                            <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              {{ statusLabel[c.status] }}
                            </span>
                          }
                        </div>

                        <p class="m-0 text-xs text-slate-500">
                          Eğitmen: <span class="font-bold text-slate-700">{{ c.instructorName }}</span>
                          · Seviye: <span class="font-medium text-slate-700">{{ levelLabel[c.level ?? 'all'] }}</span>
                          @if (c.description) {
                            · <span class="text-slate-500">{{ c.description }}</span>
                          }
                        </p>
                      </div>
                    </div>

                    <!-- Sağ: Kontenjan ve Katılım / Yönetim Aksiyonları -->
                    <div class="flex items-center justify-between md:justify-end gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <!-- Kontenjan Göstergesi -->
                      <div class="text-right">
                        <div class="text-xs font-bold text-slate-800">
                          {{ c.currentBookings }} / {{ c.capacity }} <span class="text-[11px] font-normal text-slate-500">Kişi</span>
                        </div>
                        <div class="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                          <div class="h-full rounded-full transition-all"
                               [class.bg-emerald-500]="c.currentBookings < c.capacity * 0.8"
                               [class.bg-amber-500]="c.currentBookings >= c.capacity * 0.8 && c.currentBookings < c.capacity"
                               [class.bg-rose-500]="c.currentBookings >= c.capacity"
                               [style.width.%]="(c.currentBookings / c.capacity) * 100"></div>
                        </div>
                      </div>

                      <!-- Kayıt Butonları -->
                      <div class="flex items-center gap-1.5">
                        @if (c.status === 'active') {
                          @if (myBooking(c.id); as booking) {
                            <button type="button"
                                    class="odv-btn-soft !text-xs !py-1.5 !px-3 font-semibold !text-rose-600 !border-rose-200"
                                    [disabled]="busyId() === c.id"
                                    (click)="cancel(booking)">
                              <mat-icon class="icon-size-3.5">event_busy</mat-icon>
                              Kayıtlısın (İptal)
                            </button>
                          } @else if (c.currentBookings >= c.capacity) {
                            <span class="px-3 py-1.5 text-xs font-bold text-slate-400 bg-slate-100 rounded-lg">Kontenjan Dolu</span>
                          } @else {
                            <button type="button"
                                    class="odv-btn-primary !text-xs !py-1.5 !px-3 font-semibold"
                                    [disabled]="busyId() === c.id"
                                    (click)="enroll(c)">
                              <mat-icon class="icon-size-3.5">how_to_reg</mat-icon>
                              Kayıt Ol
                            </button>
                          }
                        }

                        @if (isAdmin()) {
                          <button type="button" class="odv-icon-btn" title="Düzenle" (click)="openForm(c)">
                            <mat-icon class="icon-size-4">edit</mat-icon>
                          </button>
                          <button type="button" class="odv-icon-btn odv-icon-btn-danger" title="Sil" (click)="remove(c)">
                            <mat-icon class="icon-size-4">delete</mat-icon>
                          </button>
                        }
                      </div>
                    </div>
                  </div>
                }
              </div>
            </section>
          }
        </div>
      }
    </div>

    <!-- ADMIN DERS EKLEME / DÜZENLEME SLIDE-OVER -->
    <app-slide-over
      [open]="drawerOpen()"
      [title]="editing() ? 'Ders & Seansı Düzenle' : 'Yeni Ders Tanımla'"
      [submitLabel]="editing() ? 'Değişiklikleri Kaydet' : 'Dersi Kaydet'"
      [submitting]="submitting()"
      [errorMessage]="errorMessage()"
      (closed)="close()"
      (submitted)="submit()"
    >
      <div [formGroup]="form" class="space-y-4">
        <app-field label="Ders / Seans Adı" [required]="true" [error]="err('name', { required: 'Ders adı gerekli.' })">
          <input type="text" formControlName="name" class="odv-input" placeholder="Örn. Kickboks Fight Club, Reformer Pilates" />
        </app-field>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <app-field label="Spor Branşı">
            <select formControlName="disciplineId" class="odv-input bg-white">
              <option value="">-- Branş Seçin --</option>
              @for (d of disciplines(); track d.id) {
                <option [value]="d.id">{{ d.name }}</option>
              }
            </select>
          </app-field>

          <app-field label="Salon / Stüdyo Alanı">
            <select formControlName="facilityId" class="odv-input bg-white">
              <option value="">-- Alan Seçin --</option>
              @for (f of facilities(); track f.id) {
                <option [value]="f.id">{{ f.name }}</option>
              }
            </select>
          </app-field>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <app-field label="Eğitmen Adı" [required]="true" [error]="err('instructorName', { required: 'Eğitmen adı gerekli.' })">
            <input type="text" formControlName="instructorName" class="odv-input" placeholder="Örn. Murat Hoca" />
          </app-field>
          <app-field label="Seviye">
            <select formControlName="level" class="odv-input bg-white">
              <option value="all">Tüm Seviyeler</option>
              <option value="beginner">Başlangıç</option>
              <option value="intermediate">Orta</option>
              <option value="advanced">İleri Seviye</option>
            </select>
          </app-field>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <app-field label="Haftanın Günü" [required]="true">
            <select formControlName="dayOfWeek" class="odv-input bg-white">
              @for (d of dayOrder; track d) {
                <option [ngValue]="d">{{ dayLabel[d] }}</option>
              }
            </select>
          </app-field>

          <app-field label="Başlangıç Saati" [required]="true" [error]="err('startTime', { required: 'Saat gerekli.' })">
            <input type="time" formControlName="startTime" class="odv-input" />
          </app-field>

          <app-field label="Bitiş Saati" [required]="true" [error]="err('endTime', { required: 'Saat gerekli.' })">
            <input type="time" formControlName="endTime" class="odv-input" />
          </app-field>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <app-field label="Maksimum Kontenjan" [required]="true" [error]="err('capacity', { required: 'Kontenjan gerekli.', min: 'En az 1.' })">
            <input type="number" min="1" formControlName="capacity" class="odv-input" />
          </app-field>

          @if (editing()) {
            <app-field label="Durum">
              <select formControlName="status" class="odv-input bg-white">
                <option value="active">Aktif</option>
                <option value="paused">Askıda</option>
                <option value="cancelled">İptal</option>
              </select>
            </app-field>
          }
        </div>

        <!-- Zorunlu Evrak & Lisans Şartları -->
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <label class="block text-xs font-bold text-slate-700">Seans İçin Zorunlu Evrak Şartı</label>
          <div class="flex items-center gap-4 flex-wrap text-xs text-slate-700">
            <label class="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" [checked]="hasDocRequirement('health_report')" (change)="toggleDocRequirement('health_report')" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <span>Sağlık Raporu</span>
            </label>
            <label class="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" [checked]="hasDocRequirement('federation_license')" (change)="toggleDocRequirement('federation_license')" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <span>Sporcu Lisansı</span>
            </label>
            <label class="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" [checked]="hasDocRequirement('parent_permission')" (change)="toggleDocRequirement('parent_permission')" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <span>Veli İzin Belgesi</span>
            </label>
          </div>
          <p class="m-0 text-[11px] text-slate-500">
            İşaretli belgeleri onaylanmamış üyelerin bu seansa kaydı sistem tarafından kısıtlanır.
          </p>
        </div>

        <app-field label="Ders Açıklaması">
          <textarea formControlName="description" rows="2" class="odv-input resize-none" placeholder="Ders içeriği, getirilmesi gereken ekipmanlar (eldiven, mat vb.)"></textarea>
        </app-field>
      </div>
    </app-slide-over>
  `,
})
export class ClassSchedule {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ClassesService);
  private readonly disciplinesService = inject(AdminDisciplinesService);
  private readonly documentsService = inject(MemberDocumentsService);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly dayOrder = DAY_ORDER;
  protected readonly dayLabel = DAY_LABEL;
  protected readonly levelLabel = LEVEL_LABEL;
  protected readonly statusLabel = STATUS_LABEL;

  protected readonly isAdmin = computed(() => this.auth.profile()?.role === 'admin');
  protected readonly currentUserId = computed(() => this.auth.profile()?.uid || '');

  protected readonly schedules = toSignal(this.service.watchSchedules(), { initialValue: null });
  private readonly bookings = toSignal(this.service.watchMyBookings(), { initialValue: [] as ClassBooking[] });

  // Branşlar ve Alanlar
  protected readonly disciplines = toSignal(this.disciplinesService.watchDisciplines(), { initialValue: [] as SportsDiscipline[] });
  protected readonly facilities = toSignal(this.disciplinesService.watchFacilities(), { initialValue: [] as GymFacility[] });

  // Üyenin Evrakları (Evrak Uyumluluk Kontrolü)
  protected readonly myDocs = toSignal(this.documentsService.watchMemberDocuments(this.currentUserId()), { initialValue: [] as MemberDocument[] });

  protected readonly approvedDocsCount = computed(() => {
    return this.myDocs().filter((d) => d.status === 'approved').length;
  });

  /** Üye sadece aktif dersleri görür; admin hepsini. */
  protected readonly days = computed(() => {
    const list = (this.schedules() ?? []).filter((c) => this.isAdmin() || c.status === 'active');
    return DAY_ORDER.map((day) => ({
      day,
      classes: list.filter((c) => c.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    })).filter((g) => g.classes.length > 0);
  });

  private readonly activeBookings = computed(
    () => new Map(this.bookings().filter((b) => b.attendanceStatus === 'booked').map((b) => [b.classScheduleId, b])),
  );

  protected readonly busyId = signal('');
  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<ScheduleModel | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly selectedDocRequirements = signal<string[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    disciplineId: [''],
    facilityId: [''],
    instructorName: ['', [Validators.required]],
    dayOfWeek: [1 as Day],
    level: ['all' as NonNullable<ScheduleModel['level']>],
    startTime: ['18:00', [Validators.required]],
    endTime: ['19:00', [Validators.required]],
    capacity: [20, [Validators.required, Validators.min(1)]],
    status: ['active' as ScheduleModel['status']],
    description: [''],
  });

  protected getDiscipline(id?: string | null): SportsDiscipline | undefined {
    if (!id) return undefined;
    return this.disciplines().find((d) => d.id === id);
  }

  protected getFacility(id?: string | null): GymFacility | undefined {
    if (!id) return undefined;
    return this.facilities().find((f) => f.id === id);
  }

  protected formatDocRequirements(reqs: string[]): string {
    const map: Record<string, string> = {
      health_report: 'Sağlık Raporu',
      federation_license: 'Lisans',
      parent_permission: 'Veli İzni',
    };
    return reqs.map((r) => map[r] || r).join(', ');
  }

  protected hasDocRequirement(key: string): boolean {
    return this.selectedDocRequirements().includes(key);
  }

  protected toggleDocRequirement(key: string): void {
    const cur = this.selectedDocRequirements();
    if (cur.includes(key)) {
      this.selectedDocRequirements.set(cur.filter((k) => k !== key));
    } else {
      this.selectedDocRequirements.set([...cur, key]);
    }
  }

  protected myBooking(scheduleId: string): ClassBooking | undefined {
    return this.activeBookings().get(scheduleId);
  }

  protected err(name: keyof typeof this.form.controls, messages: Record<string, string>): string {
    return firstError(this.form.controls[name], messages);
  }

  // ---- Üye: Kayıt Olurken Evrak Uyumluluk Kontrolü (Compliance Check) ----
  protected async enroll(schedule: ScheduleModel): Promise<void> {
    // 1. Evrak Şartı Kontrolü
    const reqs = schedule.requiredDocuments || [];
    if (reqs.length > 0 && !this.isAdmin()) {
      const userApprovedDocs = this.myDocs().filter((d) => d.status === 'approved');
      
      for (const req of reqs) {
        const hasValidDoc = userApprovedDocs.some((d) => d.documentType === req);
        if (!hasValidDoc) {
          const reqName = this.formatDocRequirements([req]);
          this.snackBar.open(
            `⚠️ Kayıt Reddedildi: Bu seansa katılabilmek için onaylı "${reqName}" belgeniz olmalıdır. Lütfen profilinizden belgenizi yükleyiniz.`,
            'Anladım',
            { duration: 5500 },
          );
          return;
        }
      }
    }

    // 2. Kayıt İşlemi
    this.busyId.set(schedule.id);
    try {
      await this.service.enroll(schedule);
      this.snackBar.open(`${schedule.name} dersine kaydınız başarıyla oluşturuldu!`, 'Kapat', { duration: 3000 });
    } catch (error) {
      this.snackBar.open(error instanceof Error && error.message ? error.message : 'Kayıt yapılamadı.', 'Kapat', { duration: 3500 });
    } finally {
      this.busyId.set('');
    }
  }

  protected async cancel(booking: ClassBooking): Promise<void> {
    if (!confirm(`"${booking.className}" dersi kaydını iptal etmek istediğinize emin misiniz?`)) return;
    this.busyId.set(booking.classScheduleId);
    try {
      await this.service.cancelBooking(booking);
      this.snackBar.open('Kaydınız iptal edildi.', 'Kapat', { duration: 2500 });
    } catch {
      this.snackBar.open('İptal edilemedi, tekrar deneyin.', 'Kapat', { duration: 3000 });
    } finally {
      this.busyId.set('');
    }
  }

  // ---- Admin: Form Açma / Kaydetme ----
  protected openForm(schedule: ScheduleModel | null = null): void {
    this.editing.set(schedule);
    this.errorMessage.set('');
    this.selectedDocRequirements.set(schedule?.requiredDocuments || []);
    this.form.reset({
      name: schedule?.name ?? '',
      disciplineId: schedule?.disciplineId ?? '',
      facilityId: schedule?.facilityId ?? '',
      instructorName: schedule?.instructorName ?? '',
      dayOfWeek: schedule?.dayOfWeek ?? 1,
      level: schedule?.level ?? 'all',
      startTime: schedule?.startTime ?? '18:00',
      endTime: schedule?.endTime ?? '19:00',
      capacity: schedule?.capacity ?? 20,
      status: schedule?.status ?? 'active',
      description: schedule?.description ?? '',
    });
    this.drawerOpen.set(true);
  }

  protected close(): void {
    this.drawerOpen.set(false);
    this.editing.set(null);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    if (v.endTime <= v.startTime) {
      this.errorMessage.set('Bitiş saati başlangıçtan sonra olmalı.');
      return;
    }
    const current = this.editing();
    if (current && v.capacity < current.currentBookings) {
      this.errorMessage.set(`Kontenjan mevcut kayıt sayısından (${current.currentBookings}) az olamaz.`);
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set('');
    try {
      const payload = {
        name: v.name.trim(),
        disciplineId: v.disciplineId || null,
        facilityId: v.facilityId || null,
        instructorName: v.instructorName.trim(),
        dayOfWeek: v.dayOfWeek,
        level: v.level,
        startTime: v.startTime,
        endTime: v.endTime,
        capacity: v.capacity,
        requiredDocuments: this.selectedDocRequirements(),
        description: v.description.trim(),
      };
      if (current) {
        await this.service.updateSchedule(current.id, { ...payload, status: v.status });
      } else {
        await this.service.createSchedule(payload);
      }
      this.snackBar.open(current ? 'Ders güncellendi.' : 'Ders eklendi.', 'Kapat', { duration: 3000 });
      this.close();
    } catch {
      this.errorMessage.set('Kaydedilemedi, lütfen tekrar deneyin.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected async remove(schedule: ScheduleModel): Promise<void> {
    if (!confirm(`"${schedule.name}" dersini silmek istediğinize emin misiniz?`)) return;
    try {
      await this.service.deleteSchedule(schedule.id);
      this.snackBar.open('Ders silindi.', 'Kapat', { duration: 2500 });
    } catch {
      this.snackBar.open('Ders silinemedi, tekrar deneyin.', 'Kapat', { duration: 3000 });
    }
  }
}
