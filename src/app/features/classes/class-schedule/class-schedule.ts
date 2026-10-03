import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ClassBooking, ClassSchedule as ScheduleModel } from '../../../core/models/class-schedule.model';
import { ClassRosterPanel } from '../class-roster/class-roster';
import { SportsDiscipline } from '../../../core/models/sports-discipline.model';
import { GymFacility } from '../../../core/models/gym-equipment.model';
import { MemberDocument } from '../../../core/models/member-document.model';
import { UserProfile } from '../../../core/models/user-profile.model';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Field } from '../../../shared/ui/field';
import { SlideOver } from '../../../shared/ui/slide-over';
import { firstError } from '../../../shared/ui/ui-utils';
import { toAppError } from '../../../shared/models/app-error.model';
import { ClassesService, MemberClassSchedule } from '../classes.service';
import { AdminDisciplinesService } from '../../../admin/disciplines/admin-disciplines.service';
import { MemberDocumentsService } from '../../../core/services/member-documents.service';
import { AdminMembersService } from '../../../admin/members/admin-members.service';
import { AdminStaffService } from '../../../admin/staff/admin-staff.service';
import { StaffMember } from '../../../core/models/staff.model';
import { DocumentDefinitionsService } from '../../../core/services/document-definitions.service';
import { DocumentDefinitionsModal } from '../../../shared/components/document-definitions-modal/document-definitions-modal';

type Day = ScheduleModel['dayOfWeek'];

/** Üye rezervasyonunda MainApi hata kodlarının Türkçe karşılığı. */
const MEMBER_BOOKING_ERRORS: Record<string, string> = {
  GYM_CLASS_FULL: 'Bu seansın kontenjanı doldu; bekleme listesine katılabilirsin.',
  GYM_CLASS_NO_CREDIT: 'Paketinde ders hakkı kalmadı.',
  GYM_WAITLIST_EXISTS: 'Bu seans için zaten kaydın var.',
  GYM_CLASS_NOT_FOUND: 'Bu ders artık rezervasyona açık değil.',
  GYM_BOOKING_NOT_FOUND: 'Rezervasyon bulunamadı.',
};

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

const DAY_SHORT_LABEL: Record<Day, string> = {
  0: 'Paz',
  1: 'Pzt',
  2: 'Sal',
  3: 'Çar',
  4: 'Per',
  5: 'Cum',
  6: 'Cmt',
};

const AGE_PRESETS = [
  { value: 'Tüm Yaş Grupları', label: 'Tüm Yaşlar (Genel)', icon: '👥' },
  { value: 'Çocuk Grubu (4 - 7 Yaş)', label: 'Çocuk Grubu (4-7 Yaş)', icon: '👶' },
  { value: 'Çocuk Grubu (8 - 12 Yaş)', label: 'Çocuk Grubu (8-12 Yaş)', icon: '🧒' },
  { value: 'Çocuk Grubu (Genel)', label: 'Çocuk Grubu (Genel)', icon: '🧒' },
  { value: 'Genç Grubu (13 - 17 Yaş)', label: 'Genç Grubu (13-17 Yaş)', icon: '🏃' },
  { value: 'Yetişkin (+18 Yaş)', label: 'Yetişkin (+18 Yaş)', icon: '🏋️' },
  { value: 'Bebek & Ebeveyn (0 - 3 Yaş)', label: 'Bebek & Ebeveyn (0-3)', icon: '🍼' },
];

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
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    PageHeader,
    SlideOver,
    Field,
    ClassRosterPanel,
    DocumentDefinitionsModal,
  ],
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
            <span>Yeni Ders Tanımla</span>
          </button>
        }
      </app-page-header>

      <!-- ANTRENÖR ÖZEL GÖRÜNÜM BANNERI -->
      @if (isTrainer()) {
        <div class="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-3 shadow-xs">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <mat-icon class="icon-size-5">sports</mat-icon>
            </div>
            <div>
              <h4 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider m-0">Antrenör Özel Seans & Öğrenci Paneli</h4>
              <p class="text-xs text-slate-600 dark:text-slate-300 m-0 mt-0.5">
                Hoş geldiniz, <strong class="text-indigo-600 dark:text-indigo-400">{{ currentUserName() }}</strong>. Yalnızca size tanımlanmış grup seansları ve öğrencileriniz görüntülenmektedir.
              </p>
            </div>
          </div>
          <span class="text-xs font-black px-3 py-1 rounded-full bg-indigo-600 text-white">
            Eğitmen Modu
          </span>
        </div>
      }

      <!-- BİLGİLENDİRME / EVRAK UYARISI BANNERI -->
      <div class="odv-card p-4 bg-gradient-to-r from-indigo-50/70 via-sky-50/50 to-white dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
            <mat-icon class="icon-size-5">verified_user</mat-icon>
          </div>
          <div>
            <h4 class="m-0 text-sm font-bold text-slate-900 dark:text-white">Sporcu Güvenliği & Evrak / E-İmza Takibi</h4>
            <p class="m-0 text-xs text-slate-600 dark:text-slate-300">
              Dövüş sporları (Kickboks, Boks) ve özel seanslar için Sağlık Raporu, Lisans veya Dijital Taahhütname zorunludur. Öğrenci atamaları yetkili antrenör ve resepsiyonist tarafından gerçekleştirilir.
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
            Resepsiyon & Eğitmen Kontrolü Aktif
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
          <h3 class="mt-3 text-base font-bold text-slate-800 dark:text-white">Ders Bulunamadı</h3>
          <p class="text-xs text-slate-500 mt-1 mb-4">
            {{ isTrainer() ? 'Adınıza tanımlı aktif bir seans bulunamadı.' : 'Şu an için aktif haftalık grup seansı bulunmamaktadır.' }}
          </p>
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
                <h3 class="m-0 text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  {{ dayLabel[group.day] }}
                </h3>
                <span class="text-xs text-slate-400 font-semibold">({{ group.classes.length }} Seans)</span>
              </div>

              <div class="odv-card divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/90 dark:border-slate-800 shadow-xs">
                @for (c of group.classes; track c.id) {
                  @let discipline = getDiscipline(c.disciplineId);
                  @let facility = getFacility(c.facilityId);
                  @let enrolledCount = c.enrolledMemberIds?.length ?? c.currentBookings;

                  <div class="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <!-- Sol: Saat ve Seans Künyesi -->
                    <div class="flex items-start sm:items-center gap-4">
                      <!-- Saat Rozeti -->
                      <div class="w-24 flex-shrink-0 text-center bg-slate-100/80 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-2 rounded-xl">
                        <span class="block text-xs font-black text-slate-900 dark:text-white font-mono">{{ c.startTime }}</span>
                        <span class="block text-[10px] font-bold text-slate-400 font-mono">{{ c.endTime }}</span>
                      </div>

                      <!-- İsim ve Rozetler -->
                      <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap mb-1">
                          <h4 class="m-0 text-base font-bold text-slate-900 dark:text-white">{{ c.name }}</h4>
                          
                          @if (discipline) {
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {{ discipline.name }}
                            </span>
                          }

                          @if (facility) {
                            <span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              📍 {{ facility.name }}
                            </span>
                          }

                          @if (c.daysOfWeek && c.daysOfWeek.length > 1) {
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1" title="Haftalık Tekrarlanan Günler">
                              <mat-icon class="icon-size-3">event_repeat</mat-icon>
                              <span>{{ formatDaysBadge(c.daysOfWeek) }}</span>
                            </span>
                          }

                          @if (c.ageGroup && c.ageGroup !== 'Tüm Yaş Grupları') {
                            <span
                              class="text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1"
                              [class]="isKidsGroup(c.ageGroup)
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'"
                            >
                              <mat-icon class="icon-size-3">{{ isKidsGroup(c.ageGroup) ? 'child_care' : 'groups' }}</mat-icon>
                              <span>{{ c.ageGroup }}</span>
                            </span>
                          }

                          @if (c.requiredDocuments?.length) {
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
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

                        <p class="m-0 text-xs text-slate-500 dark:text-slate-400">
                          Eğitmen: <span class="font-bold text-slate-700 dark:text-slate-200">{{ c.instructorName }}</span>
                          · Seviye: <span class="font-medium text-slate-700 dark:text-slate-200">{{ levelLabel[c.level ?? 'all'] }}</span>
                          @if (c.description) {
                            · <span class="text-slate-500">{{ c.description }}</span>
                          }
                        </p>
                      </div>
                    </div>

                    <!-- Sağ: Kontenjan ve Katılım / Yönetim Aksiyonları -->
                    <div class="flex items-center justify-between md:justify-end gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                      <!-- Kontenjan Göstergesi -->
                      <div class="text-right">
                        <div class="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {{ enrolledCount }} / {{ c.capacity }} <span class="text-[11px] font-normal text-slate-500">Öğrenci</span>
                        </div>
                        <div class="w-24 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                          <div class="h-full rounded-full transition-all"
                               [class.bg-emerald-500]="enrolledCount < c.capacity * 0.8"
                               [class.bg-amber-500]="enrolledCount >= c.capacity * 0.8 && enrolledCount < c.capacity"
                               [class.bg-rose-500]="enrolledCount >= c.capacity"
                               [style.width.%]="(enrolledCount / c.capacity) * 100"></div>
                        </div>
                      </div>

                      <!-- Yönetim & Öğrenci Atama Butonları -->
                      <div class="flex items-center gap-1.5">
                        @if (canManage()) {
                          <!-- Antrenör & Resepsiyonist Öğrenci Yönetim Butonu -->
                          <button
                            type="button"
                            (click)="openStudentManager(c)"
                            class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <mat-icon class="icon-size-3.5">group_add</mat-icon>
                            <span>Öğrenci Yönetimi ({{ enrolledCount }}/{{ c.capacity }})</span>
                          </button>
                          <button
                            type="button"
                            (click)="rosterClass.set(c)"
                            class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                            title="Seans yoklaması ve bekleme listesi"
                          >
                            <mat-icon class="icon-size-3.5">fact_check</mat-icon>
                            <span>Yoklama</span>
                          </button>
                        } @else if (memberState(c); as m) {
                          <!-- Üye: sıradaki seans için rezervasyon / bekleme listesi -->
                          <span class="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{{ sessionLabel(m.sessionDate) }}</span>
                          @if (m.booked) {
                            <span class="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">Rezervasyonlu</span>
                            <button type="button" class="odv-btn-ghost" [disabled]="busyId() === c.id" (click)="cancelMine(c)">İptal Et</button>
                          } @else if (m.waitlisted) {
                            <span class="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">Bekleme Listesindesin</span>
                          } @else if (m.capacity > 0 && m.taken >= m.capacity) {
                            <button type="button" class="odv-btn-soft" [disabled]="busyId() === c.id" (click)="waitlist(c)">Bekleme Listesine Katıl</button>
                          } @else {
                            <button type="button" class="odv-btn-primary" [disabled]="busyId() === c.id" (click)="book(c)">Rezervasyon Yap</button>
                          }
                        } @else {
                          <span class="text-xs text-slate-500 font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                            Resepsiyon & Eğitmen Kontrolünde
                          </span>
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

    <!-- 1. DERS EKLEME / DÜZENLEME SLIDE-OVER -->
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
            <select formControlName="disciplineId" class="odv-input bg-white dark:bg-slate-800">
              <option value="">-- Branş Seçin --</option>
              @for (d of disciplines(); track d.id) {
                <option [value]="d.id">{{ d.name }}</option>
              }
            </select>
          </app-field>

          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Salon / Stüdyo Alanı
              </label>
              @if (isAdmin()) {
                <button
                  type="button"
                  (click)="openQuickFacilityModal()"
                  class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Yeni salon veya stüdyo alanı tanımla"
                >
                  <mat-icon class="icon-size-3">add_circle</mat-icon>
                  <span>+ Yeni Alan Ekle</span>
                </button>
              }
            </div>
            <select formControlName="facilityId" class="odv-input bg-white dark:bg-slate-800">
              <option value="">-- Alan Seçin --</option>
              @for (f of facilities(); track f.id) {
                <option [value]="f.id">{{ f.name }}</option>
              }
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <app-field label="Eğitmen Adı" [required]="true" [error]="err('instructorName', { required: 'Eğitmen adı gerekli.' })">
            @if (!isCustomTrainer()) {
              <div class="flex items-center gap-2">
                <select
                  [value]="selectedTrainerValue()"
                  (change)="onTrainerSelect($event)"
                  class="odv-input bg-white dark:bg-slate-800 flex-1"
                >
                  <option value="">-- Antrenör Listesinden Seçin --</option>
                  @for (t of trainers(); track t.id) {
                    <option [value]="t.displayName">
                      {{ t.displayName }} ({{ t.title || 'Antrenör' }})
                    </option>
                  }
                </select>
                <button
                  type="button"
                  (click)="toggleCustomTrainer(true)"
                  class="px-2.5 py-2 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1"
                  title="Listede olmayan farklı bir antrenör veya misafir eğitmen adı yazın"
                >
                  <mat-icon class="icon-size-3">edit</mat-icon>
                  <span>Özel Eğitmen</span>
                </button>
              </div>
            } @else {
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  formControlName="instructorName"
                  class="odv-input flex-1"
                  placeholder="Örn. Murat Hoca, Misafir Antrenör"
                />
                <button
                  type="button"
                  (click)="toggleCustomTrainer(false)"
                  class="px-2.5 py-2 rounded-xl text-[11px] font-bold border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1"
                  title="Antrenör listesinden seçmeye geri dön"
                >
                  <mat-icon class="icon-size-3">list</mat-icon>
                  <span>Listeden Seç</span>
                </button>
              </div>
            }
          </app-field>

          <app-field label="Seviye">
            <select formControlName="level" class="odv-input bg-white dark:bg-slate-800">
              <option value="all">Tüm Seviyeler</option>
              <option value="beginner">Başlangıç</option>
              <option value="intermediate">Orta</option>
              <option value="advanced">İleri Seviye</option>
            </select>
          </app-field>
        </div>

        <!-- Çoklu Gün Seçimi -->
        <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
          <div class="flex items-center justify-between flex-wrap gap-1">
            <label class="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <mat-icon class="icon-size-3.5 text-indigo-600 dark:text-indigo-400">calendar_today</mat-icon>
              <span>Haftanın Günleri (Çoklu Seçim)</span>
              <span class="text-rose-500">*</span>
            </label>

            <!-- Hızlı Seçim Kısa Yolları -->
            <div class="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                (click)="setPresetDays([1, 3, 5])"
                class="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer bg-white dark:bg-slate-800"
                title="Pazartesi, Çarşamba, Cuma"
              >
                Pzt-Çar-Cum
              </button>
              <button
                type="button"
                (click)="setPresetDays([2, 4, 6])"
                class="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer bg-white dark:bg-slate-800"
                title="Salı, Perşembe, Cumartesi"
              >
                Sal-Per-Cmt
              </button>
              <button
                type="button"
                (click)="setPresetDays([1, 2, 3, 4, 5])"
                class="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer bg-white dark:bg-slate-800"
                title="Hafta İçi Tüm Günler"
              >
                Hafta İçi
              </button>
              <button
                type="button"
                (click)="setPresetDays([6, 0])"
                class="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer bg-white dark:bg-slate-800"
                title="Cumartesi ve Pazar"
              >
                Hafta Sonu
              </button>
            </div>
          </div>

          <!-- Gün Seçim Butonları -->
          <div class="grid grid-cols-7 gap-1.5">
            @for (d of dayOrder; track d) {
              <button
                type="button"
                (click)="toggleDay(d)"
                class="py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer border"
                [class]="isDaySelected(d)
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs shadow-indigo-600/30 font-black'
                  : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'"
              >
                <span class="text-[11px]">{{ dayShortLabel[d] }}</span>
                @if (isDaySelected(d)) {
                  <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
                } @else {
                  <span class="w-1.5 h-1.5 rounded-full bg-transparent"></span>
                }
              </button>
            }
          </div>

          <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Seçilen günler: <strong class="text-indigo-600 dark:text-indigo-400">{{ formatSelectedDaysSummary() }}</strong></span>
            <span class="font-medium text-slate-400">Tek tıkla ekle/çıkar</span>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          <app-field label="Durum">
            <select formControlName="status" class="odv-input bg-white dark:bg-slate-800">
              <option value="active">Aktif</option>
              <option value="paused">Askıda</option>
              <option value="cancelled">İptal</option>
            </select>
          </app-field>
        </div>

        <!-- Yaş Grubu / Hedef Kitle (Çocuk Grubu vb.) -->
        <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <mat-icon class="icon-size-3.5 text-amber-500">child_care</mat-icon>
              <span>Yaş Grubu / Hedef Kitle (Çocuk Grubu vb.)</span>
            </label>
            @if (form.controls.ageGroup.value) {
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
                {{ form.controls.ageGroup.value }}
              </span>
            }
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            @for (preset of agePresets; track preset.value) {
              <button
                type="button"
                (click)="selectAgeGroup(preset.value)"
                class="p-2 rounded-lg border text-left text-xs transition-all cursor-pointer flex items-center gap-1.5"
                [class]="form.controls.ageGroup.value === preset.value && !isCustomAge()
                  ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold ring-1 ring-amber-500'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'"
              >
                <span>{{ preset.icon }}</span>
                <span class="truncate">{{ preset.label }}</span>
              </button>
            }
            <button
              type="button"
              (click)="toggleCustomAge(true)"
              class="p-2 rounded-lg border text-left text-xs transition-all cursor-pointer flex items-center gap-1.5"
              [class]="isCustomAge()
                ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold ring-1 ring-amber-500'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'"
            >
              <span>✏️</span>
              <span class="truncate">Özel Yaş Grubu</span>
            </button>
          </div>

          @if (isCustomAge()) {
            <div class="pt-1">
              <input
                type="text"
                [value]="form.controls.ageGroup.value"
                (input)="onCustomAgeInput($event)"
                class="odv-input text-xs"
                placeholder="Örn. 5-10 Yaş Çocuk Grubu, Kadınlara Özel, Genç Gelişim vb."
              />
            </div>
          }
        </div>

        <!-- Zorunlu Evrak ve E-İmza Taahhüt Seçimi -->
        <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-bold text-slate-800 dark:text-slate-200">
              Zorunlu Evrak & Belge Şartları
            </label>
            <button type="button" (click)="showDocDefsModal.set(true)"
              class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1">
              <mat-icon class="icon-size-3">settings</mat-icon>
              <span>Belge Türlerini Yönet / Ekle</span>
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
            @for (def of docDefsService.activeDefinitions(); track def.id) {
            <label class="flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all"
              [class]="hasDocRequirement(def.code) ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 font-bold text-indigo-900 dark:text-indigo-200' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/50'">
              <input type="checkbox" [checked]="hasDocRequirement(def.code)" (change)="toggleDocRequirement(def.code)"
                class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <span class="truncate">{{ def.name }}</span>
            </label>
            }
          </div>
          <p class="m-0 text-[11px] text-slate-500">
            Bu şartları taşımayan üyeler için üye evrak sekmesinde "Doküman Bekleniyor" uyarısı gösterilir.
          </p>
        </div>

        <app-field label="Ders Açıklaması">
          <textarea formControlName="description" rows="2" class="odv-input resize-none" placeholder="Ders içeriği, getirilmesi gereken ekipmanlar vb."></textarea>
        </app-field>
      </div>
    </app-slide-over>

    <!-- 2. RESEPSİYON & ANTRENÖR ÖĞRENCİ YÖNETİMİ SLIDE-OVER -->
    @if (selectedScheduleForStudents(); as sc) {
      <app-slide-over
        [open]="studentDrawerOpen()"
        [title]="sc.name + ' · Katılımcı Yönetimi'"
        submitLabel="Kapat"
        (closed)="closeStudentManager()"
        (submitted)="closeStudentManager()"
      >
        <div class="space-y-5">
          <!-- Seans Özeti -->
          <div class="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60">
            <div class="flex items-center justify-between text-xs font-bold text-indigo-900 dark:text-indigo-200 mb-1">
              <span>{{ dayLabel[sc.dayOfWeek] }} · {{ sc.startTime }} - {{ sc.endTime }}</span>
              <span>Kontenjan: {{ (sc.enrolledMemberIds?.length || 0) }} / {{ sc.capacity }}</span>
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-400 m-0">Eğitmen: <strong>{{ sc.instructorName }}</strong></p>
          </div>

          <!-- Yeni Öğrenci Ata Bölümü -->
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white m-0">Seansa Öğrenci Ata</h4>
            <div class="flex items-center gap-2">
              <select [(ngModel)]="selectedMemberIdToAssign" class="odv-input text-xs flex-1">
                <option value="">-- Salondan Üye Seçin --</option>
                @for (m of unassignedMembers(); track m.uid) {
                  <option [value]="m.uid">
                    {{ m.displayName || m.email }} (No: {{ m.memberNumber || '—' }})
                  </option>
                }
              </select>
              <button
                type="button"
                (click)="assignSelectedMember()"
                [disabled]="!selectedMemberIdToAssign"
                class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex-shrink-0"
              >
                Derse Ekle
              </button>
            </div>
          </div>

          <!-- Kayıtlı Öğrenciler Listesi -->
          <div>
            <h4 class="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Kayıtlı Öğrenciler ({{ enrolledStudents().length }})
            </h4>

            <div class="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              @for (st of enrolledStudents(); track st.uid) {
                <div class="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div class="flex items-center gap-3">
                    <span class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {{ st.displayName.charAt(0) || 'Ö' }}
                    </span>
                    <div>
                      <div class="flex items-center gap-2">
                        <strong class="text-xs font-bold text-slate-900 dark:text-white">{{ st.displayName || st.email }}</strong>
                        @if (st.memberNumber) {
                          <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-500">#{{ st.memberNumber }}</span>
                        }
                      </div>
                      <p class="text-[11px] text-slate-400 m-0">{{ st.phone || st.email }}</p>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <!-- E-İmza & Evrak Onay Butonu -->
                    <button
                      type="button"
                      (click)="openDocSignModal(st)"
                      class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1"
                      title="Evrak ve E-İmza Onayı"
                    >
                      <mat-icon class="icon-size-3">draw</mat-icon>
                      <span>E-İmza / Evrak</span>
                    </button>

                    <!-- Dersten Çıkar Butonu -->
                    <button
                      type="button"
                      (click)="removeStudentFromClass(st)"
                      class="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center justify-center cursor-pointer transition-colors"
                      title="Seans Kaydını Sil"
                    >
                      <mat-icon class="icon-size-4">person_remove</mat-icon>
                    </button>
                  </div>
                </div>
              } @empty {
                <div class="p-8 text-center text-xs text-slate-400">
                  Bu seansa henüz kayıtlı öğrenci bulunmuyor. Yukarıdaki alandan öğrenci ataması yapabilirsiniz.
                </div>
              }
            </div>
          </div>
        </div>
      </app-slide-over>
    }

    <!-- 3. EVRAK & E-İMZA ONAY MODALI -->
    @if (signingStudent(); as st) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <mat-icon class="text-indigo-600 dark:text-indigo-400 icon-size-5">draw</mat-icon>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white m-0">Sporcu Taahhütnamesi & E-İmza Onayı</h3>
            </div>
            <button type="button" (click)="closeDocSignModal()" class="text-slate-400 hover:text-slate-600 cursor-pointer">
              <mat-icon class="icon-size-4">close</mat-icon>
            </button>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
            <p class="m-0">Öğrenci: <strong class="text-slate-900 dark:text-white">{{ st.displayName || st.email }}</strong></p>
            <p class="m-0 text-slate-500">Üye No: #{{ st.memberNumber || '—' }} · TCKN: {{ st.phone || '—' }}</p>
          </div>

          <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs space-y-3">
            <p class="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed m-0">
              "Spor tesisinde katılacağım antrenman ve seanslarda sağlık durumumun elverişli olduğunu, antrenör direktiflerine riayet edeceğimi ve doğabilecek riskleri peşinen kabul ettiğimi beyan ve taahhüt ederim."
            </p>
            <label class="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white cursor-pointer">
              <input type="checkbox" [(ngModel)]="agreementAccepted" class="rounded text-indigo-600 focus:ring-indigo-500" />
              <span>Taahhütname okundu, dijital e-imza ile onaylandı.</span>
            </label>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" (click)="closeDocSignModal()" class="odv-btn-ghost text-xs">Vazgeç</button>
            <button
              type="button"
              (click)="saveDigitalSignature()"
              [disabled]="!agreementAccepted"
              class="odv-btn-primary text-xs disabled:opacity-50"
            >
              E-İmzayı Onayla ve Kaydet
            </button>
          </div>
        </div>
      </div>
    }

    <app-class-roster [schedule]="rosterClass()" [members]="allMembers()" (closed)="rosterClass.set(null)" />

    <app-document-definitions-modal
      [open]="showDocDefsModal()"
      (closed)="showDocDefsModal.set(false)"
      (definitionCreated)="toggleDocRequirement($event.code)"
    />

    <!-- 4. YENİ SALON / STÜDYO ALANI TANIMLAMA MODALI -->
    @if (showFacilityModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <mat-icon class="icon-size-4">meeting_room</mat-icon>
              </div>
              <div>
                <h3 class="text-sm font-bold text-slate-900 dark:text-white m-0">Yeni Salon / Stüdyo Alanı</h3>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 m-0">Derslerin verileceği alanı sisteme ekleyin</p>
              </div>
            </div>
            <button type="button" (click)="closeQuickFacilityModal()" class="text-slate-400 hover:text-slate-600 cursor-pointer">
              <mat-icon class="icon-size-4">close</mat-icon>
            </button>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Alan / Stüdyo Adı <span class="text-rose-500">*</span>
              </label>
              <input
                type="text"
                [(ngModel)]="newFacilityName"
                class="odv-input"
                placeholder="Örn. Reformer Stüdyosu, Tatami Salonu, Boks Ringi"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Maksimum Kapasite
              </label>
              <input
                type="number"
                min="1"
                [(ngModel)]="newFacilityCapacity"
                class="odv-input"
                placeholder="20"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Açıklama (İsteğe Bağlı)
              </label>
              <input
                type="text"
                [(ngModel)]="newFacilityDescription"
                class="odv-input"
                placeholder="Örn. 2. Kat Stüdyo B, Aynalı Salon"
              />
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" (click)="closeQuickFacilityModal()" class="odv-btn-ghost text-xs">Vazgeç</button>
            <button
              type="button"
              (click)="saveQuickFacility()"
              [disabled]="!newFacilityName.trim() || savingFacility()"
              class="odv-btn-primary text-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              @if (savingFacility()) {
                <mat-icon class="animate-spin icon-size-3.5">progress_activity</mat-icon>
                <span>Kaydediliyor...</span>
              } @else {
                <mat-icon class="icon-size-3.5">check</mat-icon>
                <span>Alanı Kaydet ve Seç</span>
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ClassSchedule {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ClassesService);
  private readonly disciplinesService = inject(AdminDisciplinesService);
  private readonly documentsService = inject(MemberDocumentsService);
  private readonly membersService = inject(AdminMembersService);
  private readonly staffService = inject(AdminStaffService);
  protected readonly docDefsService = inject(DocumentDefinitionsService);
  protected readonly auth = inject(AuthService);
  private readonly alertService = inject(AlertService);

  protected readonly showDocDefsModal = signal(false);

  protected readonly dayOrder = DAY_ORDER;
  protected readonly dayLabel = DAY_LABEL;
  protected readonly dayShortLabel = DAY_SHORT_LABEL;
  protected readonly levelLabel = LEVEL_LABEL;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly agePresets = AGE_PRESETS;

  protected readonly isAdmin = computed(() => {
    const role = this.auth.profile()?.role;
    return role === 'admin' || role === 'owner';
  });

  protected readonly isTrainer = computed(() => this.auth.profile()?.role === 'trainer');
  protected readonly isReceptionist = computed(() => this.auth.profile()?.role === 'receptionist');
  /** Öğrenci ataması ve yoklama: yönetici, antrenör ve resepsiyon (MainApi'de classes:update izni). */
  protected readonly canManage = computed(() => this.isAdmin() || this.isTrainer() || this.isReceptionist());
  /** Üye hesabı personel uçlarından (branş, alan, üye listesi) 403 alır; onları hiç istemez. */
  protected readonly isMember = this.service.isMember();
  protected readonly busyId = signal<string | null>(null);
  protected readonly currentUserId = computed(() => this.auth.profile()?.uid || '');
  protected readonly currentUserName = computed(() => this.auth.profile()?.displayName || 'Antrenör');

  protected readonly schedules = toSignal(this.service.watchSchedules(), { initialValue: null });
  protected readonly disciplines = toSignal(
    this.isMember ? of([] as SportsDiscipline[]) : this.disciplinesService.watchDisciplines(),
    { initialValue: [] as SportsDiscipline[] },
  );
  protected readonly facilities = toSignal(
    this.isMember ? of([] as GymFacility[]) : this.disciplinesService.watchFacilities(),
    { initialValue: [] as GymFacility[] },
  );
  protected readonly staffList = toSignal(
    this.isMember ? of([] as StaffMember[]) : this.staffService.watchStaff(),
    { initialValue: [] as StaffMember[] },
  );

  protected readonly trainers = computed(() => {
    const list = this.staffList();
    return list
      .filter(
        (s) =>
          s.status === 'active' &&
          (s.role === 'trainer' ||
            s.role === 'admin' ||
            s.role === 'owner' ||
            s.title?.toLowerCase().includes('antren') ||
            s.title?.toLowerCase().includes('hoca') ||
            s.title?.toLowerCase().includes('pt')),
      )
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'));
  });

  /** Yoklama paneli açık olan ders (seans bazında kayıt, yoklama, bekleme listesi). */
  protected readonly rosterClass = signal<ScheduleModel | null>(null);
  protected readonly allMembers = toSignal(
    this.isMember ? of([] as UserProfile[]) : this.membersService.watchMembers(),
    { initialValue: [] as UserProfile[] },
  );

  // Antrenör görünümünde yalnızca kendi derslerini filtreleme + çoklu gün desteği
  protected readonly days = computed(() => {
    let list = this.schedules() ?? [];

    if (this.isTrainer()) {
      const trainerName = this.currentUserName().trim().toLowerCase();
      const trainerUid = this.currentUserId();
      list = list.filter((c) => {
        const matchUid = c.instructorId && c.instructorId === trainerUid;
        const matchName = trainerName && c.instructorName?.toLowerCase().includes(trainerName);
        return matchUid || matchName;
      });
    } else if (!this.isAdmin()) {
      list = list.filter((c) => c.status === 'active');
    }

    return DAY_ORDER.map((day) => ({
      day,
      classes: list
        .filter((c) => {
          if (c.daysOfWeek && Array.isArray(c.daysOfWeek) && c.daysOfWeek.length > 0) {
            return c.daysOfWeek.includes(day);
          }
          return c.dayOfWeek === day;
        })
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    })).filter((g) => g.classes.length > 0);
  });

  // Ders Oluşturma Formu
  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<ScheduleModel | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly selectedDocRequirements = signal<string[]>([]);

  // Eğitmen Seçimi Durumu
  protected readonly isCustomTrainer = signal(false);
  protected selectedInstructorId = '';

  // Hızlı Salon / Stüdyo Alanı Tanımlama Modalı
  protected readonly showFacilityModal = signal(false);
  protected newFacilityName = '';
  protected newFacilityCapacity = 20;
  protected newFacilityDescription = '';
  protected readonly savingFacility = signal(false);

  // Çoklu Gün Seçimi
  protected readonly selectedDays = signal<Day[]>([1]);

  // Yaş Grubu Seçimi
  protected readonly isCustomAge = signal(false);

  // Öğrenci Yönetimi Slide-Over
  protected readonly studentDrawerOpen = signal(false);
  protected readonly selectedScheduleForStudents = signal<ScheduleModel | null>(null);
  protected selectedMemberIdToAssign = '';

  // E-İmza Modal
  protected readonly signingStudent = signal<UserProfile | null>(null);
  protected agreementAccepted = false;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    disciplineId: [''],
    facilityId: [''],
    instructorName: ['', [Validators.required]],
    dayOfWeek: [1 as Day],
    ageGroup: [''],
    level: ['all' as NonNullable<ScheduleModel['level']>],
    startTime: ['18:00', [Validators.required]],
    endTime: ['19:00', [Validators.required]],
    capacity: [20, [Validators.required, Validators.min(1)]],
    status: ['active' as ScheduleModel['status']],
    description: [''],
  });

  protected memberState(schedule: ScheduleModel) {
    return (schedule as Partial<MemberClassSchedule>).member ?? null;
  }

  protected sessionLabel(sessionDate: string): string {
    const date = new Date(`${sessionDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', weekday: 'short' });
  }

  protected async book(schedule: ScheduleModel): Promise<void> {
    await this.memberAction(schedule.id, () => this.service.bookNextSession(schedule.id), 'Rezervasyonun alındı.');
  }

  protected async waitlist(schedule: ScheduleModel): Promise<void> {
    await this.memberAction(schedule.id, () => this.service.joinWaitlist(schedule.id), 'Bekleme listesine eklendin.');
  }

  protected async cancelMine(schedule: ScheduleModel): Promise<void> {
    const bookingId = this.memberState(schedule)?.bookingId;
    if (!bookingId) return;
    const ok = await this.alertService.actionConfirm(
      'Rezervasyon İptali',
      'Seanstan 2 saatten az kala yapılan iptallerde ders hakkı iade edilmez. İptal etmek istiyor musun?',
      'Rezervasyonu İptal Et',
      'warning',
    );
    if (!ok) return;
    await this.memberAction(schedule.id, () => this.service.cancelMyBooking(bookingId), 'Rezervasyonun iptal edildi.');
  }

  private async memberAction(id: string, run: () => Promise<void>, success: string): Promise<void> {
    if (this.busyId()) return;
    this.busyId.set(id);
    try {
      await run();
      this.alertService.toastSuccess(success);
    } catch (err: unknown) {
      this.alertService.toastError(MEMBER_BOOKING_ERRORS[toAppError(err).code] ?? 'İşlem tamamlanamadı, tekrar dene.');
    } finally {
      this.busyId.set(null);
    }
  }

  protected getDiscipline(id?: string | null): SportsDiscipline | undefined {
    if (!id) return undefined;
    return this.disciplines().find((d) => d.id === id);
  }

  protected getFacility(id?: string | null): GymFacility | undefined {
    if (!id) return undefined;
    return this.facilities().find((f) => f.id === id);
  }

  protected formatDocRequirements(reqs: string[]): string {
    return reqs.map((r) => this.docDefsService.getLabel(r)).join(', ');
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

  protected err(name: keyof typeof this.form.controls, messages: Record<string, string>): string {
    return firstError(this.form.controls[name], messages);
  }

  // ---- Admin / Eğitmen: Öğrenci Yönetimi ----
  protected openStudentManager(schedule: ScheduleModel): void {
    this.selectedScheduleForStudents.set(schedule);
    this.selectedMemberIdToAssign = '';
    this.studentDrawerOpen.set(true);
  }

  protected closeStudentManager(): void {
    this.studentDrawerOpen.set(false);
    this.selectedScheduleForStudents.set(null);
  }

  protected readonly enrolledStudents = computed(() => {
    const sc = this.selectedScheduleForStudents();
    if (!sc) return [];
    const enrolledIds = sc.enrolledMemberIds || [];
    return this.allMembers().filter((m) => enrolledIds.includes(m.uid));
  });

  protected readonly unassignedMembers = computed(() => {
    const sc = this.selectedScheduleForStudents();
    if (!sc) return this.allMembers();
    const enrolledIds = sc.enrolledMemberIds || [];
    return this.allMembers().filter((m) => !enrolledIds.includes(m.uid));
  });

  protected async assignSelectedMember(): Promise<void> {
    const sc = this.selectedScheduleForStudents();
    if (!sc || !this.selectedMemberIdToAssign) return;

    try {
      await this.service.assignMemberToClass(sc.id, this.selectedMemberIdToAssign);
      this.alertService.toastSuccess('Öğrenci başarıyla derse atandı.');
      
      // Update local state in schedule
      const updatedIds = [...(sc.enrolledMemberIds || []), this.selectedMemberIdToAssign];
      this.selectedScheduleForStudents.set({
        ...sc,
        enrolledMemberIds: updatedIds,
        currentBookings: updatedIds.length,
      });
      this.selectedMemberIdToAssign = '';
    } catch (e: any) {
      this.alertService.toastError(e.message || 'Öğrenci atanamadı.');
    }
  }

  protected async removeStudentFromClass(student: UserProfile): Promise<void> {
    const sc = this.selectedScheduleForStudents();
    if (!sc) return;

    const ok = await this.alertService.actionConfirm(
      'Dersten Çıkar',
      `<strong>${student.displayName || student.email}</strong> isimli öğrenciyi bu dersten çıkarmak istiyor musunuz?`,
      'Çıkar',
      'warning',
    );
    if (!ok) return;

    try {
      await this.service.removeMemberFromClass(sc.id, student.uid);
      this.alertService.toastSuccess('Öğrenci dersten çıkarıldı.');
      const updatedIds = (sc.enrolledMemberIds || []).filter((id) => id !== student.uid);
      this.selectedScheduleForStudents.set({
        ...sc,
        enrolledMemberIds: updatedIds,
        currentBookings: updatedIds.length,
      });
    } catch (e: any) {
      this.alertService.toastError(e.message || 'Öğrenci çıkarılamadı.');
    }
  }

  // ---- E-İmza & Taahhütname Onay Modal ----
  protected openDocSignModal(student: UserProfile): void {
    this.signingStudent.set(student);
    this.agreementAccepted = false;
  }

  protected closeDocSignModal(): void {
    this.signingStudent.set(null);
  }

  protected async saveDigitalSignature(): Promise<void> {
    const st = this.signingStudent();
    if (!st || !this.agreementAccepted) return;

    try {
      await this.documentsService.addDocument({
        userId: st.uid,
        documentType: 'waiver_form',
        documentName: 'Sporcu Taahhütnamesi & Sağlık Beyanı (E-İmzalı)',
        issueDate: new Date(),
        status: 'approved',
        notes: `Antrenör onaylı dijital e-imza kaydı. Tarih: ${new Date().toLocaleDateString('tr-TR')}`,
      });
      this.alertService.toastSuccess('Dijital taahhütname ve e-imza başarıyla onaylandı.');
      this.closeDocSignModal();
    } catch (e: any) {
      this.alertService.toastError(e.message || 'E-İmza kaydedilemedi.');
    }
  }

  // ---- Eğitmen Listesi & Özel Eğitmen Girişi ----
  protected toggleCustomTrainer(custom: boolean): void {
    this.isCustomTrainer.set(custom);
    if (!custom) {
      const first = this.trainers()[0];
      if (first) {
        this.form.patchValue({ instructorName: first.displayName });
        this.selectedInstructorId = first.uid || first.id;
      }
    }
  }

  protected onTrainerSelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const name = select.value;
    this.form.patchValue({ instructorName: name });
    const trainer = this.trainers().find((t) => t.displayName === name);
    this.selectedInstructorId = trainer?.uid || trainer?.id || '';
  }

  protected selectedTrainerValue(): string {
    return this.form.controls.instructorName.value;
  }

  // ---- Hızlı Salon / Stüdyo Alanı Tanımlama ----
  protected openQuickFacilityModal(): void {
    this.newFacilityName = '';
    this.newFacilityCapacity = 20;
    this.newFacilityDescription = '';
    this.showFacilityModal.set(true);
  }

  protected closeQuickFacilityModal(): void {
    this.showFacilityModal.set(false);
  }

  protected async saveQuickFacility(): Promise<void> {
    const name = this.newFacilityName.trim();
    if (!name || this.savingFacility()) return;

    this.savingFacility.set(true);
    try {
      const facilityId = await this.disciplinesService.createFacility({
        name,
        capacity: Number(this.newFacilityCapacity) || 20,
        description: this.newFacilityDescription.trim() || undefined,
        disciplineIds: [],
        status: 'active',
      });
      this.form.patchValue({ facilityId });
      this.alertService.toastSuccess(`"${name}" stüdyo alanı başarıyla oluşturuldu ve seçildi.`);
      this.closeQuickFacilityModal();
    } catch {
      this.alertService.toastError('Salon alanı oluşturulamadı, lütfen tekrar deneyin.');
    } finally {
      this.savingFacility.set(false);
    }
  }

  // ---- Çoklu Gün Seçimi ----
  protected isDaySelected(day: Day): boolean {
    return this.selectedDays().includes(day);
  }

  protected toggleDay(day: Day): void {
    const current = this.selectedDays();
    if (current.includes(day)) {
      if (current.length === 1) {
        this.alertService.toastError('En az bir gün seçili olmalıdır.');
        return;
      }
      this.selectedDays.set(current.filter((d) => d !== day));
    } else {
      this.selectedDays.set(
        [...current, day].sort((a, b) => {
          const orderA = DAY_ORDER.indexOf(a);
          const orderB = DAY_ORDER.indexOf(b);
          return orderA - orderB;
        }),
      );
    }
    if (this.selectedDays().length > 0) {
      this.form.patchValue({ dayOfWeek: this.selectedDays()[0] });
    }
  }

  protected setPresetDays(days: Day[]): void {
    this.selectedDays.set(days);
    if (days.length > 0) {
      this.form.patchValue({ dayOfWeek: days[0] });
    }
  }

  protected formatSelectedDaysSummary(): string {
    const days = this.selectedDays();
    if (days.length === 0) return 'Gün seçilmedi';
    if (days.length === 7) return 'Her gün (7 gün)';
    return days.map((d) => DAY_LABEL[d]).join(', ') + ` (${days.length} gün)`;
  }

  protected formatDaysBadge(days?: number[]): string {
    if (!days || days.length === 0) return '';
    return days.map((d) => DAY_SHORT_LABEL[d as Day] || String(d)).join(', ');
  }

  // ---- Yaş Grubu Seçimi ----
  protected isKidsGroup(ageGroup?: string): boolean {
    if (!ageGroup) return false;
    const lower = ageGroup.toLowerCase();
    return lower.includes('çocuk') || lower.includes('bebek') || lower.includes('kid') || lower.includes('child');
  }

  protected selectAgeGroup(value: string): void {
    this.isCustomAge.set(false);
    this.form.patchValue({ ageGroup: value });
  }

  protected toggleCustomAge(custom: boolean): void {
    this.isCustomAge.set(custom);
    if (custom) {
      if (!this.form.controls.ageGroup.value || AGE_PRESETS.some((p) => p.value === this.form.controls.ageGroup.value)) {
        this.form.patchValue({ ageGroup: '' });
      }
    }
  }

  protected onCustomAgeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.patchValue({ ageGroup: input.value });
  }

  // ---- Admin: Ders Tanımlama ve Güncelleme ----
  protected openForm(schedule: ScheduleModel | null = null): void {
    this.editing.set(schedule);
    this.errorMessage.set('');
    this.selectedDocRequirements.set(schedule?.requiredDocuments || []);

    // 1. Gün Seçimi
    if (schedule?.daysOfWeek && schedule.daysOfWeek.length > 0) {
      this.selectedDays.set([...schedule.daysOfWeek] as Day[]);
    } else if (schedule?.dayOfWeek != null) {
      this.selectedDays.set([schedule.dayOfWeek]);
    } else {
      this.selectedDays.set([1]);
    }

    // 2. Eğitmen Seçimi
    const instructor = schedule?.instructorName ?? (this.isTrainer() ? this.currentUserName() : '');
    this.selectedInstructorId = schedule?.instructorId ?? (this.isTrainer() ? this.currentUserId() : '');
    const trainerExists = this.trainers().some((t) => t.displayName === instructor);
    if (!instructor) {
      this.isCustomTrainer.set(false);
    } else if (trainerExists) {
      this.isCustomTrainer.set(false);
    } else {
      this.isCustomTrainer.set(true);
    }

    // 3. Yaş Grubu
    const age = schedule?.ageGroup ?? '';
    const agePresetExists = AGE_PRESETS.some((p) => p.value === age);
    if (!age || agePresetExists) {
      this.isCustomAge.set(false);
    } else {
      this.isCustomAge.set(true);
    }

    this.form.reset({
      name: schedule?.name ?? '',
      disciplineId: schedule?.disciplineId ?? '',
      facilityId: schedule?.facilityId ?? '',
      instructorName: instructor,
      dayOfWeek: this.selectedDays()[0] ?? 1,
      ageGroup: age,
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
    if (this.selectedDays().length === 0) {
      this.errorMessage.set('Lütfen en az bir gün seçin.');
      return;
    }
    const current = this.editing();
    if (current && v.capacity < (current.enrolledMemberIds?.length || current.currentBookings)) {
      this.errorMessage.set(`Kontenjan mevcut kayıt sayısından az olamaz.`);
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set('');
    try {
      const payload = {
        name: v.name.trim(),
        disciplineId: v.disciplineId || null,
        facilityId: v.facilityId || null,
        instructorId: this.selectedInstructorId || undefined,
        instructorName: v.instructorName.trim(),
        dayOfWeek: this.selectedDays()[0] as Day,
        daysOfWeek: [...this.selectedDays()],
        ageGroup: v.ageGroup?.trim() || '',
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
      this.alertService.toastSuccess(current ? 'Ders güncellendi.' : 'Yeni ders tanımlandı.');
      this.close();
    } catch (err: unknown) {
      console.error('Save class error:', err);
      const appErr = toAppError(err);
      this.errorMessage.set(appErr.message || 'Kaydedilemedi, lütfen tekrar deneyin.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected async remove(schedule: ScheduleModel): Promise<void> {
    if (!(await this.alertService.deleteConfirm(schedule.name))) return;
    try {
      await this.service.deleteSchedule(schedule.id);
      this.alertService.toastSuccess('Ders silindi.');
    } catch {
      this.alertService.toastError('Ders silinemedi, tekrar deneyin.');
    }
  }
}
