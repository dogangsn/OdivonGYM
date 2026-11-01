import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
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

const TIME_SLOTS: string[] = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30',
];

const WEEKDAY_SHORT_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const WEEKDAY_LONG_TR = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export interface CalendarDayCell {
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  appointmentCount: number;
}

export interface WeekDayColumn {
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  monthShort: string;
  weekdayShort: string;
  weekdayLong: string;
  isToday: boolean;
  appointments: PtAppointment[];
}

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
        <div actions class="flex items-center gap-2.5">
          <!-- Görünüm Değiştirici: Liste / Takvim -->
          <div class="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80">
            <button
              type="button"
              (click)="viewMode.set('list')"
              class="px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer border-0"
              [class]="viewMode() === 'list' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'"
            >
              <mat-icon class="icon-size-4">view_agenda</mat-icon>
              <span>Randevu Listesi</span>
            </button>
            <button
              type="button"
              (click)="viewMode.set('calendar')"
              class="px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer border-0"
              [class]="viewMode() === 'calendar' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'"
            >
              <mat-icon class="icon-size-4">calendar_month</mat-icon>
              <span>Takvim</span>
            </button>
          </div>

          <button
            type="button"
            class="odv-btn-primary"
            [disabled]="!canBook()"
            (click)="openForm()"
          >
            <mat-icon class="icon-size-4.5">add</mat-icon>
            <span>Randevu Al</span>
          </button>
        </div>
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

      <!-- FİLTRE, SEKME VE ARAMA ARAÇ ÇUBUĞU -->
      <div class="odv-card p-3 sm:p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <!-- Sol: Görünüm Sekmeleri + Durum Filtreleri -->
        <div class="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          <button
            type="button"
            (click)="statusFilter.set('all')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border-0"
            [class]="statusFilter() === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
          >
            Tümü ({{ totalCount() }})
          </button>
          <button
            type="button"
            (click)="statusFilter.set('upcoming')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border-0"
            [class]="statusFilter() === 'upcoming' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
          >
            Yaklaşanlar ({{ upcomingCount() }})
          </button>
          <button
            type="button"
            (click)="statusFilter.set('completed')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border-0"
            [class]="statusFilter() === 'completed' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
          >
            Tamamlananlar ({{ completedCount() }})
          </button>
          <button
            type="button"
            (click)="statusFilter.set('cancelled')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border-0"
            [class]="statusFilter() === 'cancelled' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
          >
            İptal / Gelmedi ({{ cancelledCount() }})
          </button>
        </div>

        <!-- Sağ Taraf: Modern Antrenör Popover Filtresi ve Arama Kutusu -->
        <div class="flex flex-wrap sm:flex-nowrap items-center gap-2">
          @if (!isMember && trainers().length > 0) {
            <div class="relative min-w-[200px]">
              <button
                type="button"
                (click)="filterTrainerDropdownOpen.set(!filterTrainerDropdownOpen())"
                class="w-full h-9 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between gap-2 cursor-pointer transition-all"
              >
                <div class="flex items-center gap-2 truncate">
                  <mat-icon class="icon-size-4 text-indigo-500 shrink-0">sports_gymnastics</mat-icon>
                  <span class="truncate">{{ trainerFilter() === 'all' ? 'Tüm Antrenörler' : trainerFilter() }}</span>
                </div>
                <mat-icon class="icon-size-4 text-slate-400 transition-transform duration-200 shrink-0" [class.rotate-180]="filterTrainerDropdownOpen()">expand_more</mat-icon>
              </button>

              @if (filterTrainerDropdownOpen()) {
                <div class="fixed inset-0 z-30" (click)="filterTrainerDropdownOpen.set(false)"></div>
                <div class="absolute right-0 left-0 sm:left-auto sm:w-64 mt-1.5 z-40 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden py-1.5 animate-fade-in max-h-64 overflow-y-auto custom-scroll">
                  <button
                    type="button"
                    (click)="trainerFilter.set('all'); filterTrainerDropdownOpen.set(false)"
                    class="w-full px-3.5 py-2 text-left text-xs font-bold flex items-center justify-between hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer bg-transparent border-0"
                    [class.text-indigo-600]="trainerFilter() === 'all'"
                    [class.dark:text-indigo-400]="trainerFilter() === 'all'"
                    [class.text-slate-700]="trainerFilter() !== 'all'"
                    [class.dark:text-slate-200]="trainerFilter() !== 'all'"
                  >
                    <span>Tüm Antrenörler</span>
                    @if (trainerFilter() === 'all') {
                      <mat-icon class="icon-size-4 text-indigo-600 dark:text-indigo-400">check</mat-icon>
                    }
                  </button>
                  @for (t of trainers(); track t.id) {
                    <button
                      type="button"
                      (click)="trainerFilter.set(t.displayName); filterTrainerDropdownOpen.set(false)"
                      class="w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer bg-transparent border-0"
                      [class.text-indigo-600]="trainerFilter() === t.displayName"
                      [class.dark:text-indigo-400]="trainerFilter() === t.displayName"
                      [class.text-slate-700]="trainerFilter() !== t.displayName"
                      [class.dark:text-slate-200]="trainerFilter() !== t.displayName"
                    >
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-black text-[10px] flex items-center justify-center shrink-0">
                          {{ getInitials(t.displayName) }}
                        </span>
                        <span class="truncate">{{ t.displayName }}</span>
                      </div>
                      @if (trainerFilter() === t.displayName) {
                        <mat-icon class="icon-size-4 text-indigo-600 dark:text-indigo-400 shrink-0">check</mat-icon>
                      }
                    </button>
                  }
                </div>
              }
            </div>
          }

          <div class="relative flex-1 sm:w-64">
            <mat-icon class="icon-size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">search</mat-icon>
            <input
              type="text"
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
              placeholder="Antrenör, sporcu veya not ara…"
              class="w-full h-9 pl-9 pr-8 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            @if (searchTerm()) {
              <button
                type="button"
                (click)="searchTerm.set('')"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-transparent border-0 p-0 cursor-pointer flex items-center"
              >
                <mat-icon class="icon-size-3.5">cancel</mat-icon>
              </button>
            }
          </div>
        </div>
      </div>

      <!-- ========================================================= -->
      <!-- GÖRÜNÜM 1: TAKVİM SEKME GÖRÜNÜMÜ (HAFTALIK & GÜNLÜK PLAN) -->
      <!-- ========================================================= -->
      @if (viewMode() === 'calendar') {
        <div class="space-y-4">
          <!-- Takvim Üst Navigasyon Barı -->
          <div class="odv-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-white via-indigo-50/20 to-white dark:from-slate-900 dark:via-indigo-950/15 dark:to-slate-900">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <mat-icon class="icon-size-5">calendar_month</mat-icon>
              </div>
              <div>
                <h3 class="text-sm sm:text-base font-black text-slate-900 dark:text-white m-0 tracking-tight">
                  {{ weekRangeTitle() }}
                </h3>
                <p class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 m-0">
                  Haftalık PT Seans Takvimi · Toplam {{ weekTotalAppointments() }} randevu
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                (click)="shiftWeek(-1)"
                class="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer border-0 transition-colors"
                title="Önceki Hafta"
              >
                <mat-icon class="icon-size-4">chevron_left</mat-icon>
                <span class="hidden sm:inline">Önceki</span>
              </button>
              <button
                type="button"
                (click)="resetToCurrentWeek()"
                class="h-9 px-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70 cursor-pointer transition-colors"
              >
                Bu Hafta
              </button>
              <button
                type="button"
                (click)="shiftWeek(1)"
                class="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer border-0 transition-colors"
                title="Sonraki Hafta"
              >
                <span class="hidden sm:inline">Sonraki</span>
                <mat-icon class="icon-size-4">chevron_right</mat-icon>
              </button>
            </div>
          </div>

          <!-- 7 Günlük Haftalık Takvim Sütunları -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            @for (col of weekColumns(); track col.dateStr) {
              <div
                class="odv-card flex flex-col overflow-hidden transition-all min-h-[290px]"
                [class.ring-2]="col.isToday"
                [class.ring-indigo-500]="col.isToday"
              >
                <!-- Gün Başlığı -->
                <div
                  class="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between"
                  [class]="col.isToday ? 'bg-indigo-600 text-white' : 'bg-slate-50/80 dark:bg-slate-800/50'"
                >
                  <div class="flex items-center gap-2">
                    <div
                      class="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm"
                      [class]="col.isToday ? 'bg-white/20 text-white' : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200/70 dark:border-slate-700'"
                    >
                      {{ col.dayNumber }}
                    </div>
                    <div>
                      <div class="text-xs font-extrabold leading-tight" [class]="col.isToday ? 'text-white' : 'text-slate-900 dark:text-white'">
                        {{ col.weekdayLong }}
                      </div>
                      <div class="text-[10px] font-semibold" [class]="col.isToday ? 'text-indigo-100' : 'text-slate-400'">
                        {{ col.dayNumber }} {{ col.monthShort }}
                        @if (col.isToday) { · Bugün }
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-1">
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] font-extrabold"
                      [class]="col.isToday ? 'bg-white/20 text-white' : col.appointments.length > 0 ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'"
                    >
                      {{ col.appointments.length }}
                    </span>
                    @if (canBook()) {
                      <button
                        type="button"
                        (click)="openFormForDate(col.dateStr, '14:00')"
                        class="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer border-0 transition-colors"
                        [class]="col.isToday ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-transparent hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300'"
                        title="Bu güne randevu ekle"
                      >
                        <mat-icon class="icon-size-3.5">add</mat-icon>
                      </button>
                    }
                  </div>
                </div>

                <!-- Günün Randevu Kartları -->
                <div class="p-2.5 flex-1 space-y-2 overflow-y-auto max-h-[420px] custom-scroll">
                  @for (a of col.appointments; track a.id) {
                    <div
                      (click)="openForm(a)"
                      class="p-2.5 rounded-xl border text-left transition-all hover:shadow-md cursor-pointer group relative border-l-4"
                      [class.border-l-indigo-500]="a.status === 'booked'"
                      [class.border-l-emerald-500]="a.status === 'completed'"
                      [class.border-l-slate-400]="a.status === 'cancelled'"
                      [class.border-l-rose-500]="a.status === 'no-show'"
                      [class.bg-white]="true"
                      [class.dark:bg-slate-900]="true"
                      [class.border-slate-200/80]="true"
                      [class.dark:border-slate-800]="true"
                    >
                      <!-- Üst Satır: Saat ve Durum -->
                      <div class="flex items-center justify-between gap-1 mb-1.5">
                        <span class="inline-flex items-center gap-1 text-[11px] font-black text-indigo-600 dark:text-indigo-400">
                          <mat-icon class="icon-size-3">schedule</mat-icon>
                          {{ formatTimeRange(a.appointmentTime, a.duration) }}
                        </span>
                        <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold border" [class]="statusClass[a.status]">
                          {{ statusLabel[a.status] }}
                        </span>
                      </div>

                      <!-- Sporcu / Üye -->
                      @if (a.memberName) {
                        <div class="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {{ a.memberName }}
                        </div>
                      } @else {
                        <div class="text-xs font-bold text-slate-500 dark:text-slate-400 italic truncate">
                          Bireysel PT Seansı
                        </div>
                      }

                      <!-- Antrenör -->
                      <div class="flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        <mat-icon class="icon-size-3 text-slate-400">person</mat-icon>
                        <span class="truncate">{{ a.trainerName }}</span>
                      </div>

                      <!-- Seans Türü -->
                      @if (a.sessionType) {
                        <div class="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1">
                          <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">
                            {{ a.sessionType }}
                          </span>
                          @if (a.status === 'booked') {
                            <div class="flex items-center gap-0.5 opacity-80 group-hover:opacity-100" (click)="$event.stopPropagation()">
                              <button
                                type="button"
                                (click)="markCompleted(a)"
                                class="w-5 h-5 rounded bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 flex items-center justify-center border-0 cursor-pointer"
                                title="Tamamlandı İşaretle"
                              >
                                <mat-icon class="icon-size-3">check</mat-icon>
                              </button>
                              <button
                                type="button"
                                (click)="cancel(a)"
                                class="w-5 h-5 rounded bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 hover:bg-rose-100 flex items-center justify-center border-0 cursor-pointer"
                                title="İptal Et"
                              >
                                <mat-icon class="icon-size-3">close</mat-icon>
                              </button>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  } @empty {
                    <div class="h-44 flex flex-col items-center justify-center text-center p-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      <mat-icon class="icon-size-5 text-slate-300 dark:text-slate-700 mb-1">event_available</mat-icon>
                      <span class="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Seans yok</span>
                      @if (canBook()) {
                        <button
                          type="button"
                          (click)="openFormForDate(col.dateStr, '14:00')"
                          class="mt-2 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-600 dark:text-slate-300 hover:text-indigo-600 border-0 cursor-pointer transition-colors"
                        >
                          + Randevu Ekle
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      } @else {
        <!-- ========================================================= -->
        <!-- GÖRÜNÜM 2: RANDEVU LİSTESİ GÖRÜNÜMÜ                        -->
        <!-- ========================================================= -->
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
                <span>Yeni Randevu Planla</span>
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
                          {{ getInitials(a.trainerName || 'PT') }}
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
                            {{ getInitials(a.memberName) }}
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
      }
    </div>

    <!-- ========================================================= -->
    <!-- YENİ PT RANDEVUSU / DÜZENLE SLIDE-OVER ÇEKMECESİ           -->
    <!-- ========================================================= -->
    <app-slide-over
      [open]="drawerOpen()"
      [title]="editing() ? 'PT Randevusunu Düzenle' : 'Yeni PT Randevusu Planla'"
      [submitLabel]="editing() ? 'Değişiklikleri Kaydet' : 'Randevuyu Onayla ve Kaydet'"
      [submitting]="submitting()"
      [errorMessage]="errorMessage()"
      (closed)="close()"
      (submitted)="submit()"
    >
      <div [formGroup]="form" class="space-y-5">
        <!-- 1. ANTRENÖR SEÇİMİ (MODERN POPOVER) -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <mat-icon class="icon-size-3.5 text-indigo-500">sports_gymnastics</mat-icon>
              <span>Antrenör Seçimi *</span>
            </label>
            @if (!isMember) {
              <button
                type="button"
                (click)="toggleCustomTrainer(!isCustomTrainer())"
                class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-transparent border-0 p-0 cursor-pointer flex items-center gap-1"
              >
                <mat-icon class="icon-size-3.5">{{ isCustomTrainer() ? 'list' : 'edit' }}</mat-icon>
                <span>{{ isCustomTrainer() ? 'Listeden Seç' : 'Özel / Misafir PT Yaz' }}</span>
              </button>
            }
          </div>

          @if (isMember) {
            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                  {{ getInitials(form.get('trainerName')?.value || 'PT') }}
                </div>
                <div>
                  <span class="text-[10px] font-semibold text-slate-400 block leading-none mb-0.5">Atanmış Antrenörünüz</span>
                  <strong class="text-xs font-extrabold text-slate-900 dark:text-white">{{ form.get('trainerName')?.value || 'Atanmamış' }}</strong>
                </div>
              </div>
              <span class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Kişisel PT
              </span>
            </div>
          } @else if (isCustomTrainer()) {
            <input
              type="text"
              formControlName="trainerName"
              class="odv-input"
              placeholder="Örn: Murat Hoca, Misafir Antrenör..."
            />
          } @else {
            <div class="relative">
              <button
                type="button"
                (click)="trainerDropdownOpen.set(!trainerDropdownOpen())"
                class="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 transition-all flex items-center justify-between gap-3 text-left cursor-pointer"
                [class.border-indigo-500]="trainerDropdownOpen()"
                [class.ring-2]="trainerDropdownOpen()"
                [class.ring-indigo-500/20]="trainerDropdownOpen()"
              >
                @if (selectedTrainerValue(); as tName) {
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-9 h-9 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {{ getInitials(tName) }}
                    </div>
                    <div class="min-w-0">
                      <div class="text-xs font-extrabold text-slate-900 dark:text-white truncate">{{ tName }}</div>
                      <div class="text-[11px] font-medium text-slate-400 truncate">
                        {{ selectedTrainerObj()?.title || 'Personal Trainer & Koç' }}
                      </div>
                    </div>
                  </div>
                } @else {
                  <div class="flex items-center gap-2.5 text-slate-400">
                    <mat-icon class="icon-size-5">person_search</mat-icon>
                    <span class="text-xs font-semibold">Antrenör seçin...</span>
                  </div>
                }
                <mat-icon class="icon-size-5 text-slate-400 transition-transform duration-200 shrink-0" [class.rotate-180]="trainerDropdownOpen()">expand_more</mat-icon>
              </button>

              @if (trainerDropdownOpen()) {
                <div class="fixed inset-0 z-30" (click)="trainerDropdownOpen.set(false)"></div>
                <div class="absolute left-0 right-0 mt-2 z-40 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-fade-in">
                  <div class="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
                    <div class="relative flex items-center">
                      <mat-icon class="icon-size-4 absolute left-3 text-slate-400 pointer-events-none">search</mat-icon>
                      <input
                        type="text"
                        [ngModel]="trainerSearchQuery()"
                        [ngModelOptions]="{ standalone: true }"
                        (ngModelChange)="trainerSearchQuery.set($event)"
                        (click)="$event.stopPropagation()"
                        placeholder="Antrenör adı veya uzmanlık ara..."
                        class="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div class="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 custom-scroll">
                    @for (t of filteredTrainersForPicker(); track t.id) {
                      <button
                        type="button"
                        (click)="selectTrainerFromPicker(t)"
                        class="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2.5 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer bg-transparent border-0"
                        [class.bg-indigo-50/80]="selectedTrainerValue() === t.displayName"
                        [class.dark:bg-indigo-950/40]="selectedTrainerValue() === t.displayName"
                      >
                        <div class="flex items-center gap-2.5 min-w-0">
                          <div class="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center shrink-0">
                            {{ getInitials(t.displayName) }}
                          </div>
                          <div class="min-w-0">
                            <div class="text-xs font-extrabold text-slate-900 dark:text-white truncate">{{ t.displayName }}</div>
                            <div class="text-[11px] font-medium text-slate-400 truncate">{{ t.title || 'Antrenör' }}</div>
                          </div>
                        </div>
                        @if (selectedTrainerValue() === t.displayName) {
                          <mat-icon class="icon-size-4 text-indigo-600 dark:text-indigo-400 shrink-0">check_circle</mat-icon>
                        }
                      </button>
                    } @empty {
                      <div class="p-4 text-center text-xs text-slate-400">Eşleşen antrenör bulunamadı.</div>
                    }
                  </div>
                </div>
              }
            </div>
          }
          @if (err('trainerName', { required: 'Lütfen antrenör seçin veya adını girin.' }); as tErr) {
            <p class="m-0 text-[11px] font-semibold text-rose-600">{{ tErr }}</p>
          }
        </div>

        <!-- 2. MÜŞTERİ / SPORCU ARAMA VE SEÇİMİ (SEARCHABLE MEMBER POPOVER) -->
        @if (!isMember) {
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <mat-icon class="icon-size-3.5 text-emerald-500">person_search</mat-icon>
                <span>Müşteri / Sporcu Seçimi</span>
              </label>
              @if (form.get('userId')?.value || form.get('memberName')?.value) {
                <button
                  type="button"
                  (click)="clearSelectedMember($event)"
                  class="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline bg-transparent border-0 p-0 cursor-pointer"
                >
                  Seçimi Temizle
                </button>
              }
            </div>

            <!-- Searchable Member Trigger -->
            <div class="relative">
              <button
                type="button"
                (click)="toggleMemberDropdown()"
                class="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 transition-all flex items-center justify-between gap-3 text-left cursor-pointer"
                [class.border-indigo-500]="memberDropdownOpen()"
                [class.ring-2]="memberDropdownOpen()"
                [class.ring-indigo-500/20]="memberDropdownOpen()"
              >
                @if (selectedMemberObj(); as sel) {
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-9 h-9 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {{ getInitials(sel.displayName) }}
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="text-xs font-extrabold text-slate-900 dark:text-white truncate">{{ sel.displayName }}</span>
                        <span class="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/80 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
                          #{{ sel.memberNumber || '0000' }}
                        </span>
                      </div>
                      <div class="text-[11px] font-medium text-slate-400 truncate mt-0.5">
                        {{ sel.packageLabel || 'Aktif Üye' }}
                        @if (sel.phone) { · {{ sel.phone }} }
                      </div>
                    </div>
                  </div>
                } @else if (form.get('memberName')?.value) {
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs flex items-center justify-center shrink-0">
                      {{ getInitials(form.get('memberName')?.value || '') }}
                    </div>
                    <div class="min-w-0">
                      <div class="text-xs font-extrabold text-slate-900 dark:text-white truncate">{{ form.get('memberName')?.value }}</div>
                      <div class="text-[11px] font-medium text-slate-400 truncate">
                        {{ form.get('memberPhone')?.value || 'Manuel / Misafir Sporcu' }}
                      </div>
                    </div>
                  </div>
                } @else {
                  <div class="flex items-center gap-2.5 text-slate-400">
                    <mat-icon class="icon-size-5 text-slate-400">person_search</mat-icon>
                    <span class="text-xs font-semibold">Üye adı, takip no (#) veya telefon ile ara...</span>
                  </div>
                }
                <mat-icon class="icon-size-5 text-slate-400 transition-transform duration-200 shrink-0" [class.rotate-180]="memberDropdownOpen()">expand_more</mat-icon>
              </button>

              @if (memberDropdownOpen()) {
                <div class="fixed inset-0 z-30" (click)="memberDropdownOpen.set(false)"></div>
                <div class="absolute left-0 right-0 mt-2 z-40 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-fade-in">
                  <!-- Sticky Search Bar -->
                  <div class="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
                    <div class="relative flex items-center">
                      <mat-icon class="icon-size-4 absolute left-3 text-slate-400 pointer-events-none">search</mat-icon>
                      <input
                        type="text"
                        [ngModel]="memberSearchQuery()"
                        [ngModelOptions]="{ standalone: true }"
                        (ngModelChange)="memberSearchQuery.set($event)"
                        (click)="$event.stopPropagation()"
                        placeholder="Ad soyad, #üye no veya 05xx telefon ara..."
                        class="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                      @if (memberSearchQuery()) {
                        <button
                          type="button"
                          (click)="memberSearchQuery.set(''); $event.stopPropagation()"
                          class="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-transparent border-0 p-0 cursor-pointer flex items-center"
                        >
                          <mat-icon class="icon-size-3.5">cancel</mat-icon>
                        </button>
                      }
                    </div>
                    <div class="flex items-center justify-between px-1 pt-1.5 text-[10px] font-bold text-slate-400">
                      <span>Aktif Kulüp Üyeleri</span>
                      @if (isSearchingRemote()) {
                        <span class="text-indigo-600 dark:text-indigo-400 animate-pulse">Aranıyor...</span>
                      } @else {
                        <span>{{ filteredMembersForPicker().length }} üye listeleniyor</span>
                      }
                    </div>
                  </div>

                  <!-- Member List -->
                  <div class="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 custom-scroll">
                    @for (m of filteredMembersForPicker(); track m.uid) {
                      <button
                        type="button"
                        (click)="selectMemberFromPicker(m)"
                        class="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2.5 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer bg-transparent border-0"
                        [class.bg-indigo-50/80]="form.get('userId')?.value === m.uid"
                        [class.dark:bg-indigo-950/40]="form.get('userId')?.value === m.uid"
                      >
                        <div class="flex items-center gap-2.5 min-w-0">
                          <div class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-xs flex items-center justify-center shrink-0">
                            {{ getInitials(m.displayName) }}
                          </div>
                          <div class="min-w-0">
                            <div class="flex items-center gap-1.5">
                              <span class="text-xs font-extrabold text-slate-900 dark:text-white truncate">{{ m.displayName }}</span>
                              <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 shrink-0">
                                #{{ m.memberNumber || '0000' }}
                              </span>
                            </div>
                            <div class="text-[11px] font-medium text-slate-400 truncate mt-0.5">
                              {{ m.packageLabel || 'Standart Üye' }}
                              @if (m.phone) { · {{ m.phone }} }
                            </div>
                          </div>
                        </div>
                        @if (form.get('userId')?.value === m.uid) {
                          <mat-icon class="icon-size-4 text-indigo-600 dark:text-indigo-400 shrink-0">check_circle</mat-icon>
                        }
                      </button>
                    } @empty {
                      <div class="p-5 text-center">
                        <mat-icon class="icon-size-6 text-slate-300 dark:text-slate-600 mx-auto mb-1">person_off</mat-icon>
                        <p class="m-0 text-xs font-bold text-slate-600 dark:text-slate-300">Eşleşen aktif üye bulunamadı</p>
                        <p class="m-0 text-[11px] text-slate-400 mt-0.5">Aşağıdaki alanlardan misafir sporcu adı girebilirsiniz.</p>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Hızlı İsim & Telefon Düzenleme / Misafir Girişi -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div class="relative">
                <mat-icon class="icon-size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">badge</mat-icon>
                <input
                  type="text"
                  formControlName="memberName"
                  placeholder="Sporcu Adı Soyadı"
                  class="odv-input pl-9 !py-2 text-xs"
                />
              </div>
              <div class="relative">
                <mat-icon class="icon-size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">call</mat-icon>
                <input
                  type="text"
                  formControlName="memberPhone"
                  placeholder="Telefon (05xx...)"
                  class="odv-input pl-9 !py-2 text-xs"
                />
              </div>
            </div>
          </div>
        }

        <!-- 3. SEANS TÜRÜ & ODAK ALANI -->
        <div class="space-y-2">
          <label class="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <mat-icon class="icon-size-3.5 text-indigo-500">fitness_center</mat-icon>
            <span>Seans Türü & Odak Alanı</span>
          </label>
          <div class="grid grid-cols-2 gap-2">
            @for (p of sessionPresets; track p.id) {
              <button
                type="button"
                (click)="selectSessionType(p.name)"
                class="p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5"
                [class]="form.get('sessionType')?.value === p.name ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-bold shadow-xs ring-1 ring-indigo-500/30' : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'"
              >
                <div
                  class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  [class]="form.get('sessionType')?.value === p.name ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-indigo-500'"
                >
                  <mat-icon class="icon-size-4">{{ p.icon }}</mat-icon>
                </div>
                <div class="min-w-0 flex-1">
                  <span class="text-[11px] leading-tight line-clamp-2 block">{{ p.name }}</span>
                </div>
              </button>
            }
          </div>
        </div>

        <!-- 4. İNTERAKTİF TAKVİM & SAAT DİLİMİ SEÇİCİ -->
        <div class="space-y-3 p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80">
          <div class="flex items-center justify-between">
            <label class="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <mat-icon class="icon-size-4 text-indigo-500">event</mat-icon>
              <span>Randevu Tarihi & Saati *</span>
            </label>
            <!-- Seçili Tarih & Saat Özeti -->
            @if (selectedDateStr() && selectedTimeStr()) {
              <span class="px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-[11px] font-extrabold shadow-xs">
                {{ formatSelectedDateSummary() }} · {{ selectedTimeStr() }}
              </span>
            }
          </div>

          <!-- Hızlı Gün Seçim Hapları -->
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              (click)="selectQuickDayOffset(0)"
              class="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer"
              [class]="selectedDateStr() === todayStr() ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'"
            >
              Bugün
            </button>
            <button
              type="button"
              (click)="selectQuickDayOffset(1)"
              class="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer"
              [class]="selectedDateStr() === offsetDateStr(1) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'"
            >
              Yarın
            </button>
            <button
              type="button"
              (click)="selectQuickDayOffset(2)"
              class="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer"
              [class]="selectedDateStr() === offsetDateStr(2) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'"
            >
              2 Gün Sonra
            </button>
          </div>

          <!-- Mini Aylık Takvim Kartı -->
          <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <!-- Ay Başlığı & Gezgin -->
            <div class="flex items-center justify-between mb-2.5">
              <button
                type="button"
                (click)="shiftPickerMonth(-1)"
                class="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 border-0 bg-transparent cursor-pointer"
              >
                <mat-icon class="icon-size-4">chevron_left</mat-icon>
              </button>
              <span class="text-xs font-extrabold text-slate-900 dark:text-white tracking-tight capitalize">
                {{ pickerMonthTitle() }}
              </span>
              <button
                type="button"
                (click)="shiftPickerMonth(1)"
                class="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 border-0 bg-transparent cursor-pointer"
              >
                <mat-icon class="icon-size-4">chevron_right</mat-icon>
              </button>
            </div>

            <!-- Haftanın Günleri Başlığı -->
            <div class="grid grid-cols-7 gap-1 text-center mb-1">
              @for (wd of weekdayShortTr; track wd) {
                <span class="text-[10px] font-extrabold text-slate-400 uppercase">{{ wd }}</span>
              }
            </div>

            <!-- Gün Hücreleri -->
            <div class="grid grid-cols-7 gap-1">
              @for (cell of pickerCalendarCells(); track cell.dateStr) {
                <button
                  type="button"
                  [disabled]="cell.isPast"
                  (click)="selectDateFromCalendar(cell.dateStr)"
                  class="h-8 rounded-lg text-xs font-bold flex flex-col items-center justify-center relative transition-all border-0 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                  [class]="
                    selectedDateStr() === cell.dateStr
                      ? 'bg-indigo-600 text-white font-black shadow-xs'
                      : cell.isToday
                        ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-extrabold ring-1 ring-indigo-300 dark:ring-indigo-700'
                        : cell.isCurrentMonth
                          ? 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                          : 'bg-transparent text-slate-300 dark:text-slate-600'
                  "
                >
                  <span class="leading-none">{{ cell.dayNumber }}</span>
                  @if (cell.appointmentCount > 0) {
                    <span
                      class="w-1 h-1 rounded-full mt-0.5"
                      [class]="selectedDateStr() === cell.dateStr ? 'bg-white' : 'bg-indigo-500'"
                    ></span>
                  }
                </button>
              }
            </div>
          </div>

          <!-- Saat Dilimi Seçici (Time Slots) -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300">Saat Dilimi Seçin</span>
              <div class="flex items-center gap-2 text-[10px] font-semibold text-slate-400">
                <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-indigo-600"></span> Seçili</span>
                <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-rose-400"></span> Antrenör Dolu</span>
              </div>
            </div>

            <div class="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-1 custom-scroll">
              @for (slot of timeSlots; track slot) {
                @let busy = isSlotBusyForSelectedTrainer(slot);
                <button
                  type="button"
                  (click)="selectTimeSlot(slot)"
                  class="py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1"
                  [class]="
                    selectedTimeStr() === slot
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : busy
                        ? 'bg-rose-50/80 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                  "
                  [title]="busy ? 'Seçili antrenörün bu saatte başka bir randevusu var' : slot"
                >
                  <span>{{ slot }}</span>
                </button>
              }
            </div>
          </div>

          @if (err('appointmentTime', { required: 'Lütfen tarih ve saat seçin.' }); as dtErr) {
            <p class="m-0 text-[11px] font-semibold text-rose-600">{{ dtErr }}</p>
          }
        </div>

        <!-- 5. SEANS SÜRESİ -->
        <div class="space-y-1.5">
          <label class="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <mat-icon class="icon-size-3.5 text-indigo-500">timelapse</mat-icon>
            <span>Seans Süresi</span>
          </label>
          <div class="grid grid-cols-4 gap-2">
            @for (d of durations; track d) {
              <button
                type="button"
                (click)="form.patchValue({ duration: d })"
                class="py-2.5 rounded-xl text-xs font-extrabold text-center border transition-all cursor-pointer"
                [class]="form.get('duration')?.value === d ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'"
              >
                {{ d }} dk
              </button>
            }
          </div>
        </div>

        <!-- 6. ÖZEL NOTLAR -->
        <app-field label="Notlar & Antrenman Hedefleri">
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
  protected readonly timeSlots = TIME_SLOTS;
  protected readonly weekdayShortTr = WEEKDAY_SHORT_TR;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusClass = STATUS_BADGE_CLASS;
  protected readonly dateTime = formatDateTime;

  protected readonly appointments = toSignal(this.service.watchAppointments(), { initialValue: null });

  /** Görünüm sekmesi: 'list' (Randevu Listesi) veya 'calendar' (Haftalık Takvim) */
  protected readonly viewMode = signal<'list' | 'calendar'>('list');

  /** Haftalık takvim için hafta ofseti (0 = bu hafta, -1 = geçen hafta, +1 = gelecek hafta) */
  protected readonly weekOffset = signal<number>(0);

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
  protected readonly filterTrainerDropdownOpen = signal(false);
  protected readonly searchTerm = signal<string>('');

  // Çekmece içi Popover ve Arama durumları
  protected readonly isCustomTrainer = signal(false);
  protected readonly trainerDropdownOpen = signal(false);
  protected readonly trainerSearchQuery = signal('');

  protected readonly memberDropdownOpen = signal(false);
  protected readonly memberSearchQuery = signal('');
  protected readonly remoteSearchedMembers = signal<UserProfile[]>([]);
  protected readonly isSearchingRemote = signal(false);
  private memberSearchDebounce: ReturnType<typeof setTimeout> | null = null;

  // Çekmece içi Görsel Takvim & Saat Seçici durumları
  protected readonly selectedDateStr = signal<string>(this.todayStr());
  protected readonly selectedTimeStr = signal<string>('14:00');
  protected readonly pickerMonthDate = signal<Date>(new Date());

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

    // Uzak sunucu üye araması (debounced)
    effect(() => {
      const q = this.memberSearchQuery().trim();
      if (this.memberSearchDebounce) clearTimeout(this.memberSearchDebounce);
      if (q.length < 2) {
        this.isSearchingRemote.set(false);
        return;
      }
      this.isSearchingRemote.set(true);
      this.memberSearchDebounce = setTimeout(async () => {
        try {
          const results = await this.membersService.searchMembers(q, {
            status: 'active',
            archived: false,
            limit: 30,
          });
          this.remoteSearchedMembers.set(results);
        } catch {
          // ignore
        } finally {
          this.isSearchingRemote.set(false);
        }
      }, 250);
    });
  }

  protected todayStr(): string {
    return this.offsetDateStr(0);
  }

  protected offsetDateStr(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return this.toYmd(d);
  }

  private toYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private syncFormAppointmentTime(): void {
    const dateStr = this.selectedDateStr();
    const timeStr = this.selectedTimeStr();
    if (!dateStr || !timeStr) return;
    this.form.patchValue({
      appointmentTime: `${dateStr}T${timeStr}`,
    });
  }

  protected selectDateFromCalendar(dateStr: string): void {
    this.selectedDateStr.set(dateStr);
    this.syncFormAppointmentTime();
  }

  protected selectQuickDayOffset(days: number): void {
    const d = new Date();
    d.setDate(d.getDate() + days);
    this.selectedDateStr.set(this.toYmd(d));
    this.pickerMonthDate.set(new Date(d.getFullYear(), d.getMonth(), 1));
    this.syncFormAppointmentTime();
  }

  protected selectTimeSlot(slot: string): void {
    this.selectedTimeStr.set(slot);
    this.syncFormAppointmentTime();
  }

  protected shiftPickerMonth(delta: number): void {
    const cur = this.pickerMonthDate();
    this.pickerMonthDate.set(new Date(cur.getFullYear(), cur.getMonth() + delta, 1));
  }

  protected pickerMonthTitle = computed(() => {
    return this.pickerMonthDate().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  });

  protected formatSelectedDateSummary(): string {
    const s = this.selectedDateStr();
    if (!s) return '';
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' });
  }

  protected pickerCalendarCells = computed<CalendarDayCell[]>(() => {
    const monthBase = this.pickerMonthDate();
    const year = monthBase.getFullYear();
    const month = monthBase.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    // Pazartesi = 0 ... Pazar = 6
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const startDate = new Date(year, month, 1 - startOffset);

    const todayYmd = this.todayStr();
    const allApps = this.appointments() ?? [];
    const countByDate = new Map<string, number>();
    for (const a of allApps) {
      if (a.status === 'cancelled') continue;
      const dt = toJsDate(a.appointmentTime);
      if (!dt) continue;
      const key = this.toYmd(dt);
      countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
    }

    const cells: CalendarDayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      const dateStr = this.toYmd(d);
      cells.push({
        dateStr,
        dayNumber: d.getDate(),
        isCurrentMonth: d.getMonth() === month,
        isToday: dateStr === todayYmd,
        isPast: dateStr < todayYmd,
        appointmentCount: countByDate.get(dateStr) ?? 0,
      });
    }
    return cells;
  });

  protected isSlotBusyForSelectedTrainer(slot: string): boolean {
    const trainerName = (this.form.get('trainerName')?.value || '').trim().toLowerCase();
    const dateStr = this.selectedDateStr();
    if (!trainerName || !dateStr) return false;

    const [sh, sm] = slot.split(':').map(Number);
    const slotStartMin = sh * 60 + sm;
    const duration = Number(this.form.get('duration')?.value || 60);
    const slotEndMin = slotStartMin + duration;
    const editingId = this.editing()?.id;

    const list = this.appointments() ?? [];
    return list.some((a) => {
      if (editingId && a.id === editingId) return false;
      if (a.status === 'cancelled') return false;
      if ((a.trainerName || '').trim().toLowerCase() !== trainerName) return false;
      const dt = toJsDate(a.appointmentTime);
      if (!dt || this.toYmd(dt) !== dateStr) return false;
      const existStart = dt.getHours() * 60 + dt.getMinutes();
      const existEnd = existStart + (a.duration || 60);
      return slotStartMin < existEnd && slotEndMin > existStart;
    });
  }

  // Haftalık Takvim Görünümü Hesaplamaları
  protected shiftWeek(delta: number): void {
    this.weekOffset.set(this.weekOffset() + delta);
  }

  protected resetToCurrentWeek(): void {
    this.weekOffset.set(0);
  }

  private getWeekStartDate(offsetWeeks: number): Date {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Pazartesi = 0
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + offsetWeeks * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  protected readonly weekColumns = computed<WeekDayColumn[]>(() => {
    const monday = this.getWeekStartDate(this.weekOffset());
    const todayYmd = this.todayStr();
    const apps = this.filteredAppointments();

    const cols: WeekDayColumn[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const dateStr = this.toYmd(d);
      const dayApps = apps
        .filter((a) => {
          const dt = toJsDate(a.appointmentTime);
          return dt && this.toYmd(dt) === dateStr;
        })
        .sort((a, b) => toMillis(a.appointmentTime) - toMillis(b.appointmentTime));

      cols.push({
        dateStr,
        dayNumber: d.getDate(),
        monthShort: d.toLocaleDateString('tr-TR', { month: 'short' }),
        weekdayShort: WEEKDAY_SHORT_TR[i],
        weekdayLong: WEEKDAY_LONG_TR[i],
        isToday: dateStr === todayYmd,
        appointments: dayApps,
      });
    }
    return cols;
  });

  protected readonly weekRangeTitle = computed(() => {
    const cols = this.weekColumns();
    if (!cols.length) return '';
    const first = cols[0];
    const last = cols[6];
    const monday = this.getWeekStartDate(this.weekOffset());
    return `${first.dayNumber} ${first.monthShort} – ${last.dayNumber} ${last.monthShort} ${monday.getFullYear()}`;
  });

  protected readonly weekTotalAppointments = computed(() => {
    return this.weekColumns().reduce((sum, col) => sum + col.appointments.length, 0);
  });

  protected formatTimeRange(appointmentTime: PtAppointment['appointmentTime'], duration = 60): string {
    const dt = toJsDate(appointmentTime);
    if (!dt) return '';
    const start = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    const endDt = new Date(dt.getTime() + duration * 60_000);
    const end = `${String(endDt.getHours()).padStart(2, '0')}:${String(endDt.getMinutes()).padStart(2, '0')}`;
    return `${start} - ${end}`;
  }

  // Antrenör & Üye Seçici Hesaplamaları
  protected readonly filteredTrainersForPicker = computed(() => {
    const q = this.trainerSearchQuery().trim().toLocaleLowerCase('tr');
    const list = this.trainers();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.displayName.toLocaleLowerCase('tr').includes(q) ||
        (t.title || '').toLocaleLowerCase('tr').includes(q),
    );
  });

  protected readonly selectedTrainerObj = computed(() => {
    const name = this.selectedTrainerValue();
    return this.trainers().find((t) => t.displayName === name) ?? null;
  });

  protected selectTrainerFromPicker(t: StaffMember): void {
    this.form.patchValue({
      trainerId: t.id || t.uid || '',
      trainerName: t.displayName,
    });
    this.trainerDropdownOpen.set(false);
    this.trainerSearchQuery.set('');
  }

  protected readonly activeMembersPool = computed(() => {
    const map = new Map<string, UserProfile>();
    for (const m of this.memberList()) {
      if (m?.uid) map.set(m.uid, m);
    }
    for (const m of this.remoteSearchedMembers()) {
      if (m?.uid && !map.has(m.uid)) map.set(m.uid, m);
    }
    return Array.from(map.values())
      .filter((m) => !m.isArchived && (!m.membershipStatus || m.membershipStatus === 'active'))
      .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'tr'));
  });

  protected readonly filteredMembersForPicker = computed(() => {
    const list = this.activeMembersPool();
    const q = this.memberSearchQuery().trim().toLocaleLowerCase('tr');
    if (!q) return list.slice(0, 30);
    return list
      .filter((m) => {
        const name = (m.displayName || '').toLocaleLowerCase('tr');
        const num = String(m.memberNumber || '').toLocaleLowerCase('tr');
        const phone = String(m.phone || '').toLocaleLowerCase('tr');
        return name.includes(q) || num.includes(q) || phone.includes(q);
      })
      .slice(0, 30);
  });

  protected readonly selectedMemberObj = computed(() => {
    const uid = this.form.get('userId')?.value;
    if (!uid) return null;
    return this.activeMembersPool().find((m) => m.uid === uid) || this.memberList().find((m) => m.uid === uid) || null;
  });

  protected toggleMemberDropdown(): void {
    const next = !this.memberDropdownOpen();
    this.memberDropdownOpen.set(next);
    if (next) {
      this.memberSearchQuery.set('');
    }
  }

  protected selectMemberFromPicker(m: UserProfile): void {
    this.form.patchValue({
      userId: m.uid,
      memberName: m.displayName || m.email,
      memberPhone: m.phone || '',
    });
    this.memberDropdownOpen.set(false);
    this.memberSearchQuery.set('');
  }

  protected clearSelectedMember(event: Event): void {
    event.stopPropagation();
    this.form.patchValue({
      userId: '',
      memberName: '',
      memberPhone: '',
    });
  }

  protected getInitials(name?: string): string {
    if (!name) return 'PT';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toLocaleUpperCase('tr');
    return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase('tr');
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
      if (status === 'upcoming' && !this.isUpcoming(a)) return false;
      if (status === 'completed' && a.status !== 'completed') return false;
      if (status === 'cancelled' && a.status !== 'cancelled' && a.status !== 'no-show') return false;

      if (trainer !== 'all' && a.trainerName.toLowerCase() !== trainer.toLowerCase()) return false;

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
    this.trainerDropdownOpen.set(false);
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

  protected selectSessionType(name: string): void {
    this.form.patchValue({ sessionType: name });
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

  protected openFormForDate(dateStr: string, slot = '14:00'): void {
    this.openForm(null, dateStr, slot);
  }

  protected openForm(appointment: PtAppointment | null = null, presetDateStr?: string, presetTimeStr?: string): void {
    this.editing.set(appointment);
    this.errorMessage.set('');
    this.isCustomTrainer.set(false);
    this.trainerDropdownOpen.set(false);
    this.memberDropdownOpen.set(false);

    let defaultTrainerName = '';
    let defaultTrainerId = '';

    if (appointment) {
      defaultTrainerName = appointment.trainerName || '';
      defaultTrainerId = appointment.trainerId || '';
    } else if (this.isMember) {
      defaultTrainerName = this.trainer()?.displayName ?? '';
    } else {
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

    let initDateStr = presetDateStr || this.todayStr();
    let initTimeStr = presetTimeStr || '14:00';

    if (appointment) {
      const dt = toJsDate(appointment.appointmentTime);
      if (dt) {
        initDateStr = this.toYmd(dt);
        initTimeStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
      }
    } else if (!presetDateStr) {
      // Varsayılan olarak bir sonraki uygun tam saati veya yarın 14:00'ü seç
      const now = new Date();
      if (now.getHours() >= 20) {
        initDateStr = this.offsetDateStr(1);
        initTimeStr = '14:00';
      } else {
        const nextHour = Math.max(9, now.getHours() + 1);
        initTimeStr = `${String(nextHour).padStart(2, '0')}:00`;
      }
    }

    this.selectedDateStr.set(initDateStr);
    this.selectedTimeStr.set(initTimeStr);
    const [py, pm] = initDateStr.split('-').map(Number);
    this.pickerMonthDate.set(new Date(py, pm - 1, 1));

    this.form.reset({
      trainerId: defaultTrainerId,
      trainerName: defaultTrainerName,
      userId: appointment?.userId ?? '',
      memberName: appointment?.memberName ?? '',
      memberPhone: appointment?.memberPhone ?? '',
      sessionType: appointment?.sessionType ?? 'Birebir PT (Kuvvet & Hipertrofi)',
      appointmentTime: appointment ? toDateTimeInput(appointment.appointmentTime) : `${initDateStr}T${initTimeStr}`,
      duration: appointment?.duration ?? 60,
      notes: appointment?.notes ?? '',
    });

    this.drawerOpen.set(true);
  }

  protected close(): void {
    this.drawerOpen.set(false);
    this.editing.set(null);
    this.trainerDropdownOpen.set(false);
    this.memberDropdownOpen.set(false);
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
