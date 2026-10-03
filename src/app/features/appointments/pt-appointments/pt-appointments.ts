import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertService } from '../../../core/services/alert.service';
import { PtAppointment } from '../../../core/models/pt-appointment.model';
import { StaffMember } from '../../../core/models/staff.model';
import { UserProfile } from '../../../core/models/user-profile.model';
import { AppError } from '../../../shared/models/app-error.model';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Field } from '../../../shared/ui/field';
import { SlideOver } from '../../../shared/ui/slide-over';
import {
  firstError,
  formatDateTime,
  sortDesc,
  toDateTimeInput,
  toJsDate,
  toMillis,
} from '../../../shared/ui/ui-utils';
import { AppointmentsService } from '../appointments.service';
import { AdminStaffService } from '../../../admin/staff/admin-staff.service';
import { AdminMembersService } from '../../../admin/members/admin-members.service';
import { AuthService } from '../../../core/auth/auth.service';

const STATUS_LABEL: Record<PtAppointment['status'], string> = {
  booked: 'Planlandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
  'no-show': 'Gelinmedi',
};

const STATUS_BADGE_CLASS: Record<PtAppointment['status'], string> = {
  booked: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/50',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  'no-show': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/50',
};

export interface PtSessionTypePreset {
  id: string;
  name: string;
  icon: string;
  tag: string;
}

export const PT_SESSION_PRESETS: PtSessionTypePreset[] = [
  { id: 'strength', name: 'Birebir PT (Kuvvet & Hipertrofi)', icon: 'fitness_center', tag: 'Kuvvet' },
  { id: 'cardio', name: 'Kardiyo & Kondisyon / HIIT', icon: 'directions_run', tag: 'Kardiyo' },
  { id: 'reformer', name: 'Reformer Pilates (Birebir)', icon: 'self_improvement', tag: 'Pilates' },
  { id: 'boxing', name: 'Boks / Kickboks PT', icon: 'sports_mma', tag: 'Dövüş Sporu' },
  { id: 'mobility', name: 'Mobilite & Postür / Esneklik', icon: 'accessibility_new', tag: 'Mobilite' },
  { id: 'measurement', name: 'Vücut Analizi & Ölçüm', icon: 'straighten', tag: 'Analiz' },
];

@Component({
  selector: 'app-pt-appointments',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, MatIconModule, PageHeader, SlideOver, Field],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans space-y-6 pb-20">
      <app-page-header
        title="PT Randevu & Özel Seanslar"
        icon="event_available"
        description="Personal trainer randevularını yönetin, seansları takip edin ve takvim çakışmalarını önleyin."
      >
        <button
          actions
          type="button"
          class="odv-btn-primary"
          [disabled]="!canBook()"
          (click)="openForm()"
        >
          <mat-icon class="icon-size-4.5">add</mat-icon>
          <span>Randevu Al</span>
        </button>
      </app-page-header>

      <!-- ÜYE UYARISI: ANTRENÖRÜ YOKSA -->
      @if (isMember && trainerLoaded() && !trainer()) {
        <div class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-center gap-3 text-amber-900 dark:text-amber-200 text-xs shadow-xs">
          <mat-icon class="icon-size-5 text-amber-600 dark:text-amber-400 flex-shrink-0">info</mat-icon>
          <p class="m-0 leading-relaxed">
            Henüz size atanmış bir antrenör bulunmuyor. PT randevusu alabilmek için lütfen resepsiyondan veya yönetimden antrenör ataması talep ediniz.
          </p>
        </div>
      }

      <!-- EXECUTIVE KPI METRİK KARTLARI -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Toplam Randevu -->
        <div class="odv-card p-4 sm:p-5 flex items-center gap-4 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20">
          <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 shadow-xs">
            <mat-icon class="icon-size-6">event_note</mat-icon>
          </div>
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 m-0">Toplam Randevu</p>
            <h3 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white m-0 tracking-tight">{{ totalCount() }}</h3>
          </div>
        </div>

        <!-- Yaklaşan Seanslar -->
        <div class="odv-card p-4 sm:p-5 flex items-center gap-4 bg-gradient-to-br from-white via-slate-50/50 to-sky-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/20">
          <div class="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0 shadow-xs">
            <mat-icon class="icon-size-6">schedule</mat-icon>
          </div>
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 m-0">Yaklaşan Seanslar</p>
            <h3 class="text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400 m-0 tracking-tight">{{ upcomingCount() }}</h3>
          </div>
        </div>

        <!-- Tamamlanan Seanslar -->
        <div class="odv-card p-4 sm:p-5 flex items-center gap-4 bg-gradient-to-br from-white via-slate-50/50 to-emerald-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20">
          <div class="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 shadow-xs">
            <mat-icon class="icon-size-6">check_circle</mat-icon>
          </div>
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 m-0">Tamamlanan</p>
            <h3 class="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 m-0 tracking-tight">{{ completedCount() }}</h3>
          </div>
        </div>

        <!-- İptal / Gelmedi -->
        <div class="odv-card p-4 sm:p-5 flex items-center gap-4 bg-gradient-to-br from-white via-slate-50/50 to-rose-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-rose-950/20">
          <div class="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0 shadow-xs">
            <mat-icon class="icon-size-6">event_busy</mat-icon>
          </div>
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 m-0">İptal / Gelmedi</p>
            <h3 class="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 m-0 tracking-tight">{{ cancelledCount() }}</h3>
          </div>
        </div>
      </div>

      <!-- FİLTRE VE ARAMA ARAÇ ÇUBUĞU -->
      <div class="odv-card p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <!-- Durum Sekmeleri -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            (click)="statusFilter.set('all')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
            [class]="statusFilter() === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
          >
            Tümü ({{ totalCount() }})
          </button>
          <button
            type="button"
            (click)="statusFilter.set('upcoming')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
            [class]="statusFilter() === 'upcoming' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
          >
            Yaklaşanlar ({{ upcomingCount() }})
          </button>
          <button
            type="button"
            (click)="statusFilter.set('completed')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
            [class]="statusFilter() === 'completed' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
          >
            Tamamlananlar ({{ completedCount() }})
          </button>
          <button
            type="button"
            (click)="statusFilter.set('cancelled')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
            [class]="statusFilter() === 'cancelled' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
          >
            İptal / Gelmedi ({{ cancelledCount() }})
          </button>
        </div>

        <!-- Sağ Taraf: Antrenör Filtresi ve Arama Kutusu -->
        <div class="flex items-center gap-2">
          @if (!isMember && trainers().length > 0) {
            <select
              [value]="trainerFilter()"
              (change)="onTrainerFilterChange($event)"
              class="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="all">Tüm Antrenörler</option>
              @for (t of trainers(); track t.id) {
                <option [value]="t.displayName">{{ t.displayName }}</option>
              }
            </select>
          }

          <div class="relative flex-1 sm:w-64">
            <mat-icon class="icon-size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</mat-icon>
            <input
              type="text"
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
              placeholder="Antrenör, üye veya not ara…"
              class="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
        </div>
      </div>

      <!-- RANDEVU LİSTESİ -->
      @if (appointments() === null) {
        <div class="odv-card py-20 text-center">
          <mat-icon class="icon-size-8 text-slate-300 animate-spin">refresh</mat-icon>
          <p class="mt-2 text-sm text-slate-500 font-medium">Randevular yükleniyor…</p>
        </div>
      } @else if (filteredAppointments().length === 0) {
        <div class="odv-card py-16 text-center max-w-md mx-auto">
          <div class="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
            <mat-icon class="icon-size-7">event_available</mat-icon>
          </div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white m-0">Kayıt Bulunamadı</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
            Seçili filtrelere uygun herhangi bir PT randevusu bulunmuyor.
          </p>
          @if (canBook()) {
            <button type="button" class="odv-btn-primary mx-auto" (click)="openForm()">
              <mat-icon class="icon-size-4">add</mat-icon>
              <span>+ Yeni Randevu Planla</span>
            </button>
          }
        </div>
      } @else {
        <div class="space-y-3">
          @for (a of filteredAppointments(); track a.id) {
            <div
              class="odv-card p-4 sm:p-5 transition-all hover:shadow-md border-l-4"
              [class.border-l-indigo-500]="a.status === 'booked'"
              [class.border-l-emerald-500]="a.status === 'completed'"
              [class.border-l-slate-400]="a.status === 'cancelled'"
              [class.border-l-rose-500]="a.status === 'no-show'"
            >
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <!-- Sol Kısım: Zaman & Rozetler & Katılımcı Bilgisi -->
                <div class="space-y-2.5 min-w-0 flex-1">
                  <!-- Zaman & Durum Rozeti -->
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-700">
                      <mat-icon class="icon-size-3.5 text-indigo-500">calendar_today</mat-icon>
                      <span>{{ dateTime(a.appointmentTime) }}</span>
                    </span>

                    <span class="px-2.5 py-0.5 rounded-lg text-[11px] font-bold border" [class]="statusClass[a.status]">
                      {{ statusLabel[a.status] }}
                    </span>

                    @if (getRelativeTimeBadge(a.appointmentTime); as rel) {
                      @if (rel.label && a.status === 'booked') {
                        <span
                          class="px-2 py-0.5 rounded-lg text-[11px] font-semibold"
                          [class]="rel.isUrgent ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'"
                        >
                          {{ rel.label }}
                        </span>
                      }
                    }

                    <span class="text-xs text-slate-400 flex items-center gap-1">
                      <mat-icon class="icon-size-3.5">timelapse</mat-icon>
                      {{ a.duration }} dk
                    </span>
                  </div>

                  <!-- Antrenör & Üye / Seans Detayları -->
                  <div class="flex flex-wrap items-center gap-4 text-xs">
                    <!-- Antrenör -->
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
                        {{ (a.trainerName || 'PT').charAt(0).toUpperCase() }}
                      </div>
                      <div>
                        <span class="text-slate-400 text-[10px] block leading-none">Antrenör</span>
                        <strong class="text-slate-800 dark:text-slate-200 font-semibold">{{ a.trainerName }}</strong>
                      </div>
                    </div>

                    <!-- Üye / Sporcu (Personel için) -->
                    @if (a.memberName) {
                      <div class="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                        <div class="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                          {{ a.memberName.charAt(0).toUpperCase() }}
                        </div>
                        <div>
                          <span class="text-slate-400 text-[10px] block leading-none">Sporcu / Üye</span>
                          <strong class="text-slate-800 dark:text-slate-200 font-semibold">{{ a.memberName }}</strong>
                          @if (a.memberPhone) {
                            <span class="text-slate-400 text-[11px] ml-1">({{ a.memberPhone }})</span>
                          }
                        </div>
                      </div>
                    }

                    <!-- Seans Türü -->
                    @if (a.sessionType) {
                      <div class="pl-2 border-l border-slate-200 dark:border-slate-700">
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40">
                          <mat-icon class="icon-size-3">fitness_center</mat-icon>
                          <span>{{ a.sessionType }}</span>
                        </span>
                      </div>
                    }
                  </div>

                  <!-- Notlar -->
                  @if (a.notes) {
                    <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2 border border-slate-100 dark:border-slate-800">
                      <mat-icon class="icon-size-4 text-slate-400 flex-shrink-0 mt-0.5">sticky_note_2</mat-icon>
                      <span class="italic">{{ a.notes }}</span>
                    </div>
                  }
                </div>

                <!-- Sağ Kısım: Aksiyon Butonları -->
                <div class="flex items-center gap-2 self-end md:self-center flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 w-full md:w-auto justify-end">
                  @if (a.status === 'booked') {
                    <button
                      type="button"
                      (click)="markCompleted(a)"
                      class="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Seansı tamamlandı olarak işaretle"
                    >
                      <mat-icon class="icon-size-4">check</mat-icon>
                      <span>Tamamla</span>
                    </button>

                    <button
                      type="button"
                      class="odv-icon-btn"
                      title="Randevuyu Düzenle"
                      (click)="openForm(a)"
                    >
                      <mat-icon class="icon-size-4">edit</mat-icon>
                    </button>

                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                      (click)="cancel(a)"
                    >
                      İptal Et
                    </button>
                  }

                  @if (!isMember) {
                    <button
                      type="button"
                      class="odv-icon-btn odv-icon-btn-danger"
                      title="Kaydı sil"
                      (click)="remove(a)"
                    >
                      <mat-icon class="icon-size-4">delete</mat-icon>
                    </button>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- RANDEVU AL / DÜZENLE SLIDE-OVER ÇEKMECESİ -->
    <app-slide-over
      [open]="drawerOpen()"
      [title]="editing() ? 'Randevuyu Düzenle' : 'Yeni PT Randevusu'"
      [submitLabel]="editing() ? 'Değişiklikleri Kaydet' : 'Randevuyu Onayla ve Kaydet'"
      [submitting]="submitting()"
      [errorMessage]="errorMessage()"
      (closed)="close()"
      (submitted)="submit()"
    >
      <div [formGroup]="form" class="space-y-4">
        <!-- 1. ANTRENÖR SEÇİMİ -->
        <app-field
          label="Antrenör Seçimi"
          [required]="true"
          [error]="err('trainerName', { required: 'Lütfen antrenör seçin veya adını girin.' })"
        >
          @if (isMember) {
            <!-- Üye görünümü: Atanmış antrenörü readonly göster veya seçtir -->
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                  {{ (form.get('trainerName')?.value || 'PT').charAt(0).toUpperCase() }}
                </div>
                <div>
                  <span class="text-[10px] text-slate-400 block leading-none">Atanmış Antrenörünüz</span>
                  <strong class="text-xs text-slate-900 dark:text-white">{{ form.get('trainerName')?.value || 'Atanmamış' }}</strong>
                </div>
              </div>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Kişisel PT
              </span>
            </div>
          } @else {
            <!-- Personel / Yönetici görünümü: Dropdown veya Özel İsim -->
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
                  class="px-2.5 py-2.5 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1"
                  title="Listede olmayan farklı bir antrenör veya misafir eğitmen adı yazın"
                >
                  <mat-icon class="icon-size-3.5">edit</mat-icon>
                  <span>Özel PT</span>
                </button>
              </div>
            } @else {
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  formControlName="trainerName"
                  class="odv-input flex-1"
                  placeholder="Örn. Murat Hoca, Misafir Antrenör"
                />
                <button
                  type="button"
                  (click)="toggleCustomTrainer(false)"
                  class="px-2.5 py-2.5 rounded-xl text-[11px] font-bold border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1"
                  title="Antrenör listesinden seçmeye geri dön"
                >
                  <mat-icon class="icon-size-3.5">list</mat-icon>
                  <span>Listeden Seç</span>
                </button>
              </div>
            }
          }
        </app-field>

        <!-- 2. SPORCU / ÜYE SEÇİMİ (Yalnızca Personel / Yönetici için) -->
        @if (!isMember) {
          <app-field label="Sporcu / Üye Seçimi">
            <div class="space-y-2">
              <select
                [value]="form.get('userId')?.value || ''"
                (change)="onMemberSelect($event)"
                class="odv-input bg-white dark:bg-slate-800"
              >
                <option value="">-- Üye Listesinden Seçin (İsteğe Bağlı) --</option>
                @for (m of memberList(); track m.uid) {
                  <option [value]="m.uid">
                    {{ m.displayName || m.email }} {{ m.phone ? '(' + m.phone + ')' : '' }}
                  </option>
                }
              </select>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  formControlName="memberName"
                  placeholder="Üye Adı Soyadı"
                  class="odv-input text-xs"
                />
                <input
                  type="text"
                  formControlName="memberPhone"
                  placeholder="Telefon Numarası"
                  class="odv-input text-xs"
                />
              </div>
            </div>
          </app-field>
        }

        <!-- 3. SEANS TÜRÜ / HEDEF ALAN -->
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200">
            Seans Türü & Odak Alanı
          </label>
          <div class="grid grid-cols-2 gap-2">
            @for (p of sessionPresets; track p.id) {
              <button
                type="button"
                (click)="selectSessionType(p.name)"
                class="p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2"
                [class]="form.get('sessionType')?.value === p.name ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold shadow-xs' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'"
              >
                <mat-icon class="icon-size-4 text-indigo-500">{{ p.icon }}</mat-icon>
                <div class="min-w-0 flex-1">
                  <span class="text-xs truncate block">{{ p.name }}</span>
                </div>
              </button>
            }
          </div>
        </div>

        <!-- 4. TARİH & SAAT SEÇİCİ VE HIZLI KISAYOLLAR -->
        <div class="space-y-2">
          <app-field
            label="Tarih & Saat"
            [required]="true"
            [error]="err('appointmentTime', { required: 'Tarih ve saat gerekli.' })"
          >
            <input type="datetime-local" formControlName="appointmentTime" class="odv-input" />
          </app-field>

          <!-- Hızlı Tarih / Saat Kısayolları -->
          <div class="flex flex-wrap items-center gap-1.5 pt-1">
            <span class="text-[10px] text-slate-400 font-semibold mr-1">Hızlı Saat:</span>
            <button
              type="button"
              (click)="setQuickPreset(0, 11)"
              class="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
            >
              Bugün 11:00
            </button>
            <button
              type="button"
              (click)="setQuickPreset(0, 14)"
              class="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
            >
              Bugün 14:00
            </button>
            <button
              type="button"
              (click)="setQuickPreset(0, 18)"
              class="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
            >
              Bugün 18:00
            </button>
            <button
              type="button"
              (click)="setQuickPreset(1, 14)"
              class="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
            >
              Yarın 14:00
            </button>
            <button
              type="button"
              (click)="setQuickPreset(1, 18)"
              class="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
            >
              Yarın 18:00
            </button>
          </div>
        </div>

        <!-- 5. SEANS SÜRESİ -->
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200">
            Seans Süresi
          </label>
          <div class="grid grid-cols-4 gap-2">
            @for (d of durations; track d) {
              <button
                type="button"
                (click)="form.patchValue({ duration: d })"
                class="py-2 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer"
                [class]="form.get('duration')?.value === d ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-xs' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'"
              >
                {{ d }} dk
              </button>
            }
          </div>
        </div>

        <!-- 6. ÖZEL NOTLAR -->
        <app-field label="Notlar & Hedefler">
          <textarea
            formControlName="notes"
            rows="3"
            class="odv-input resize-none"
            placeholder="Çalışılacak kas grubu, sakatlık durumu, hedef veya özel talepler…"
          ></textarea>
        </app-field>
      </div>
    </app-slide-over>
  `,
})
export class PtAppointments {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AppointmentsService);
  private readonly staffService = inject(AdminStaffService);
  private readonly membersService = inject(AdminMembersService);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alertService = inject(AlertService);

  protected readonly durations = [30, 45, 60, 90];
  protected readonly sessionPresets = PT_SESSION_PRESETS;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusClass = STATUS_BADGE_CLASS;
  protected readonly dateTime = formatDateTime;

  protected readonly appointments = toSignal(this.service.watchAppointments(), { initialValue: null });

  /** Üye randevuyu kendine atanmış antrenörle alır; personel salonun tümünü yönetir. */
  protected readonly isMember = this.service.isMember();
  protected readonly trainer = signal<{ displayName: string } | null>(null);
  protected readonly trainerLoaded = signal(false);
  protected readonly canBook = computed(() => !this.isMember || !!this.trainer());

  // Personel için antrenör ve üye listeleri
  protected readonly staffList = toSignal(
    this.isMember ? of([] as StaffMember[]) : this.staffService.watchStaff(),
    { initialValue: [] as StaffMember[] },
  );

  protected readonly memberList = toSignal(
    this.isMember ? of([] as UserProfile[]) : this.membersService.watchMembers(),
    { initialValue: [] as UserProfile[] },
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

  // Filtre durumları
  protected readonly statusFilter = signal<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');
  protected readonly trainerFilter = signal<string>('all');
  protected readonly searchTerm = signal<string>('');

  // Özel antrenör toggle
  protected readonly isCustomTrainer = signal(false);

  // Form ve modal durumları
  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<PtAppointment | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly form = this.fb.nonNullable.group({
    trainerId: [''],
    trainerName: ['', [Validators.required]],
    userId: [''],
    memberName: [''],
    memberPhone: [''],
    sessionType: ['Birebir PT (Kuvvet & Hipertrofi)'],
    appointmentTime: ['', [Validators.required]],
    duration: [60],
    notes: [''],
  });

  constructor() {
    if (this.isMember) {
      this.service.memberTrainer().subscribe({
        next: (trainer) => {
          this.trainer.set(trainer);
          this.trainerLoaded.set(true);
        },
        error: () => this.trainerLoaded.set(true),
      });
    }
  }

  private isUpcoming(a: PtAppointment): boolean {
    return a.status === 'booked' && toMillis(a.appointmentTime) >= Date.now();
  }

  // Metrikler
  protected readonly totalCount = computed(() => (this.appointments() ?? []).length);
  protected readonly upcomingCount = computed(
    () => (this.appointments() ?? []).filter((a) => this.isUpcoming(a)).length,
  );
  protected readonly completedCount = computed(
    () => (this.appointments() ?? []).filter((a) => a.status === 'completed').length,
  );
  protected readonly cancelledCount = computed(
    () => (this.appointments() ?? []).filter((a) => a.status === 'cancelled' || a.status === 'no-show').length,
  );

  // Filtrelenmiş randevular
  protected readonly filteredAppointments = computed(() => {
    const raw = this.appointments() ?? [];
    const status = this.statusFilter();
    const trainer = this.trainerFilter();
    const q = this.searchTerm().trim().toLowerCase();

    const filtered = raw.filter((a) => {
      // 1. Durum filtresi
      if (status === 'upcoming' && !this.isUpcoming(a)) return false;
      if (status === 'completed' && a.status !== 'completed') return false;
      if (status === 'cancelled' && a.status !== 'cancelled' && a.status !== 'no-show') return false;

      // 2. Antrenör filtresi
      if (trainer !== 'all' && a.trainerName.toLowerCase() !== trainer.toLowerCase()) return false;

      // 3. Arama kelimesi
      if (q) {
        const tName = (a.trainerName || '').toLowerCase();
        const mName = (a.memberName || '').toLowerCase();
        const sType = (a.sessionType || '').toLowerCase();
        const notes = (a.notes || '').toLowerCase();
        if (!tName.includes(q) && !mName.includes(q) && !sType.includes(q) && !notes.includes(q)) {
          return false;
        }
      }

      return true;
    });

    // Yaklaşanlar tarih sırasına göre, geçmişler ters tarih sırasına göre
    return sortDesc(filtered, (a) => a.appointmentTime);
  });

  protected err(name: keyof typeof this.form.controls, messages: Record<string, string>): string {
    return firstError(this.form.controls[name], messages);
  }

  protected selectedTrainerValue(): string {
    return this.form.get('trainerName')?.value || '';
  }

  protected toggleCustomTrainer(custom: boolean): void {
    this.isCustomTrainer.set(custom);
    if (!custom) {
      const first = this.trainers()[0];
      if (first) {
        this.form.patchValue({
          trainerId: first.id || first.uid || '',
          trainerName: first.displayName,
        });
      }
    }
  }

  protected onTrainerSelect(event: Event): void {
    const name = (event.target as HTMLSelectElement).value;
    const t = this.trainers().find((x) => x.displayName === name);
    this.form.patchValue({
      trainerId: t ? t.id || t.uid || '' : '',
      trainerName: name,
    });
  }

  protected onMemberSelect(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    if (!id) {
      this.form.patchValue({ userId: '', memberName: '', memberPhone: '' });
      return;
    }
    const m = this.memberList().find((x) => x.uid === id);
    if (m) {
      this.form.patchValue({
        userId: m.uid,
        memberName: m.displayName || m.email,
        memberPhone: m.phone || '',
      });
    }
  }

  protected onTrainerFilterChange(event: Event): void {
    this.trainerFilter.set((event.target as HTMLSelectElement).value);
  }

  protected selectSessionType(name: string): void {
    this.form.patchValue({ sessionType: name });
  }

  protected setQuickPreset(offsetDays: number, hour: number): void {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(hour, 0, 0, 0);
    this.form.patchValue({
      appointmentTime: toDateTimeInput(d),
    });
  }

  protected getRelativeTimeBadge(date: PtAppointment['appointmentTime']): { label: string; isUrgent: boolean } {
    const d = toJsDate(date);
    if (!d) return { label: '', isUrgent: false };
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
      return { label: 'Geçmiş', isUrgent: false };
    }
    if (diffHours < 2) {
      return { label: 'Çok Yakında', isUrgent: true };
    }
    if (diffHours < 24 && d.getDate() === now.getDate()) {
      return { label: `Bugün (${diffHours} sa)`, isUrgent: true };
    }
    if (diffDays === 1 || (diffHours < 48 && d.getDate() === now.getDate() + 1)) {
      return { label: 'Yarın', isUrgent: false };
    }
    return { label: `${diffDays} gün sonra`, isUrgent: false };
  }

  protected openForm(appointment: PtAppointment | null = null): void {
    this.editing.set(appointment);
    this.errorMessage.set('');
    this.isCustomTrainer.set(false);

    let defaultTrainerName = '';
    let defaultTrainerId = '';

    if (appointment) {
      defaultTrainerName = appointment.trainerName || '';
      defaultTrainerId = appointment.trainerId || '';
    } else if (this.isMember) {
      defaultTrainerName = this.trainer()?.displayName ?? '';
    } else {
      // Giriş yapan eğitmen ise kendini seçsin
      const currentRole = this.auth.profile()?.role;
      const currentName = this.auth.profile()?.displayName || '';
      const currentUid = this.auth.profile()?.uid || '';
      if (currentRole === 'trainer' && currentName) {
        defaultTrainerName = currentName;
        defaultTrainerId = currentUid;
      } else if (this.trainers().length > 0) {
        defaultTrainerName = this.trainers()[0].displayName;
        defaultTrainerId = this.trainers()[0].id || this.trainers()[0].uid || '';
      }
    }

    this.form.reset({
      trainerId: defaultTrainerId,
      trainerName: defaultTrainerName,
      userId: appointment?.userId ?? '',
      memberName: appointment?.memberName ?? '',
      memberPhone: appointment?.memberPhone ?? '',
      sessionType: appointment?.sessionType ?? 'Birebir PT (Kuvvet & Hipertrofi)',
      appointmentTime: appointment ? toDateTimeInput(appointment.appointmentTime) : '',
      duration: appointment?.duration ?? 60,
      notes: appointment?.notes ?? '',
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
    const when = new Date(v.appointmentTime);
    if (when.getTime() <= Date.now()) {
      this.errorMessage.set('Randevu zamanı gelecekte olmalı.');
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set('');
    try {
      const payload = {
        trainerId: v.trainerId.trim(),
        trainerName: v.trainerName.trim(),
        userId: v.userId.trim() || undefined,
        memberName: v.memberName.trim() || undefined,
        memberPhone: v.memberPhone.trim() || undefined,
        sessionType: v.sessionType.trim() || undefined,
        appointmentTime: when,
        duration: v.duration,
        notes: v.notes.trim(),
      };
      const current = this.editing();
      if (current) {
        await this.service.updateAppointment(current.id, payload);
      } else {
        await this.service.bookAppointment(payload);
      }
      this.snackBar.open(current ? 'Randevu güncellendi.' : 'Randevu başarıyla oluşturuldu.', 'Kapat', {
        duration: 3000,
      });
      this.close();
    } catch (err: unknown) {
      const msg =
        err instanceof AppError
          ? err.status === 409
            ? 'Antrenörün bu saatte başka bir randevusu var. Lütfen farklı bir saat seç.'
            : 'Kaydedilemedi, tekrar dene.'
          : err instanceof Error
            ? err.message
            : 'Kaydedilemedi, tekrar dene.';
      this.errorMessage.set(msg);
    } finally {
      this.submitting.set(false);
    }
  }

  protected async markCompleted(appointment: PtAppointment): Promise<void> {
    const ok = await this.alertService.actionConfirm(
      'Randevuyu Tamamla',
      `"${appointment.trainerName}" ile olan PT seansını tamamlandı olarak işaretlemek istediğinize emin misiniz?`,
      'Tamamlandı Olarak İşaretle',
      'success',
    );
    if (!ok) return;

    try {
      await this.service.completeAppointment(appointment.id);
      this.alertService.toastSuccess('PT seansı tamamlandı olarak işaretlendi.');
    } catch {
      this.alertService.toastError('İşlem gerçekleştirilemedi, lütfen tekrar deneyiniz.');
    }
  }

  protected async cancel(appointment: PtAppointment): Promise<void> {
    const ok = await this.alertService.actionConfirm(
      'Randevu İptali',
      'Bu randevuyu iptal etmek istediğinize emin misiniz?',
      'Randevuyu İptal Et',
      'warning',
    );
    if (!ok) return;
    try {
      await this.service.cancelAppointment(appointment.id);
      this.alertService.toastSuccess('Randevu iptal edildi.');
    } catch {
      this.alertService.toastError('İptal edilemedi, tekrar dene.');
    }
  }

  protected async remove(appointment: PtAppointment): Promise<void> {
    if (!(await this.alertService.deleteConfirm('Randevu Kaydı'))) return;
    try {
      await this.service.deleteAppointment(appointment.id);
      this.alertService.toastSuccess('Kayıt silindi.');
    } catch {
      this.alertService.toastError('Kayıt silinemedi, tekrar dene.');
    }
  }
}
