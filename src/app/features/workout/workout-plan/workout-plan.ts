import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertService } from '../../../core/services/alert.service';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { SlideOver } from '../../../shared/ui/slide-over';
import { Field } from '../../../shared/ui/field';
import {
  firstError,
  formatDate,
  fromDateInput,
  optionalNumber,
  sortDesc,
  toDateInput,
  todayInput,
} from '../../../shared/ui/ui-utils';
import { WorkoutService } from '../workout.service';
import {
  DEFAULT_EXERCISE_LIBRARY,
  Exercise,
  WorkoutPlan as PlanModel,
} from '../../../core/models/workout-plan.model';
import { MUSCLE_GROUP_LABELS, MuscleGroup } from '../../../core/models/gym-equipment.model';

const STATUS_LABEL: Record<PlanModel['status'], string> = {
  active: 'Aktif',
  paused: 'Durduruldu',
  completed: 'Tamamlandı',
  archived: 'Arşiv',
};

const STATUS_CLASS: Record<PlanModel['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  archived: 'bg-slate-100 text-slate-600 border-slate-200',
};

const MUSCLE_BADGES: Record<MuscleGroup, { label: string; class: string }> = {
  chest: { label: 'Göğüs', class: 'bg-blue-50 text-blue-700 border-blue-200' },
  back: { label: 'Sırt & Kanat', class: 'bg-purple-50 text-purple-700 border-purple-200' },
  shoulders: { label: 'Omuz & Trapez', class: 'bg-amber-50 text-amber-700 border-amber-200' },
  legs: { label: 'Bacak & Kalf', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  arms: { label: 'Kol (Biceps/Triceps)', class: 'bg-rose-50 text-rose-700 border-rose-200' },
  core: { label: 'Karın & Core', class: 'bg-teal-50 text-teal-700 border-teal-200' },
  fullbody: { label: 'Tüm Vücut', class: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

@Component({
  selector: 'app-workout-plan',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, PageHeader, SlideOver, Field],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans space-y-6 pb-20">
      <app-page-header
        title="Antrenman Programım"
        icon="fitness_center"
        description="Bölgesel split planların, hedeflenen set/tekrar ve antrenör direktiflerin ile antrenmanını tamamla."
      >
        <div actions class="flex items-center gap-2">
          @if (restTimerRunning()) {
            <div class="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-full text-indigo-700 text-xs font-bold animate-pulse">
              <mat-icon class="icon-size-4">timer</mat-icon>
              <span>Dinlenme: {{ formatSeconds(restSecondsLeft()) }}</span>
            </div>
          }
          <button type="button" class="odv-btn-primary" (click)="openForm()">
            <mat-icon class="icon-size-4.5">add</mat-icon>
            Yeni Program Ekle
          </button>
        </div>
      </app-page-header>

      <!-- CANLI DİNLENME KRONOMETRESİ BANNER / DİNLENME MODALI -->
      @if (restTimerRunning() || restFinishedAlert()) {
        <div class="odv-card border-2 p-4 transition-all duration-300"
             [class.border-indigo-500]="restTimerRunning()"
             [class.bg-indigo-50/50]="restTimerRunning()"
             [class.border-emerald-500]="restFinishedAlert()"
             [class.bg-emerald-50]="restFinishedAlert()">
          <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg transition-all"
                   [class.bg-indigo-600]="restTimerRunning()"
                   [class.text-white]="restTimerRunning()"
                   [class.bg-emerald-600]="restFinishedAlert()"
                   [class.text-white]="restFinishedAlert()"
                   [class.animate-bounce]="restFinishedAlert()">
                @if (restFinishedAlert()) {
                  <mat-icon class="icon-size-6">check</mat-icon>
                } @else {
                  <mat-icon class="icon-size-6">timer</mat-icon>
                }
              </div>
              <div>
                @if (restFinishedAlert()) {
                  <h4 class="m-0 text-base font-bold text-emerald-900">Süre Doldu! Sıradaki Sete Hazırsın 🚀</h4>
                  <p class="m-0 text-xs text-emerald-700">Mola tamamlandı, ağırlığın başına dön ve maksimum odaklan!</p>
                } @else {
                  <div class="flex items-center gap-2">
                    <h4 class="m-0 text-base font-bold text-indigo-950">Set Arası Dinlenme</h4>
                    <span class="text-xs px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-800 font-semibold">Geri Sayım</span>
                  </div>
                  <p class="m-0 text-xs text-indigo-700">Derin nefes al, nabzını toparla ve su içmeyi unutma.</p>
                }
              </div>
            </div>

            <!-- Sayı ve Kontroller -->
            <div class="flex items-center gap-3">
              <div class="text-center font-mono font-black text-3xl sm:text-4xl text-indigo-950 min-w-[5rem]">
                {{ formatSeconds(restSecondsLeft()) }}
              </div>
              <div class="flex items-center gap-1.5">
                <button type="button" class="odv-btn-soft !text-xs !py-1.5 !px-2.5" (click)="addRestTime(15)">+15 sn</button>
                <button type="button" class="odv-btn-soft !text-xs !py-1.5 !px-2.5" (click)="addRestTime(30)">+30 sn</button>
                <button type="button" class="odv-btn-secondary !text-xs !py-1.5 !px-3 font-semibold" (click)="stopRestTimer()">
                  {{ restFinishedAlert() ? 'Kapat' : 'Mola Bitti' }}
                </button>
              </div>
            </div>
          </div>
          <!-- İlerleme Çubuğu -->
          <div class="mt-3 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div class="h-full bg-indigo-600 transition-all duration-1000 ease-linear rounded-full"
                 [style.width.%]="restProgressPercent()"></div>
          </div>
        </div>
      }

      @if (plans() === null) {
        <div class="odv-card py-20 text-center">
          <mat-icon class="icon-size-8 text-slate-300 animate-spin">refresh</mat-icon>
          <p class="mt-2 text-sm text-slate-500 font-medium">Antrenman programın yükleniyor…</p>
        </div>
      } @else if (plans()!.length === 0) {
        <div class="odv-card py-16 text-center max-w-xl mx-auto">
          <div class="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3">
            <mat-icon class="icon-size-7">fitness_center</mat-icon>
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-1">Henüz Tanımlı Program Yok</h3>
          <p class="text-sm text-slate-500 mb-5 leading-relaxed">
            Antrenörün senin için bölgesel split bir program hazırlayabilir ya da kütüphaneden hazır egzersizleri seçerek hemen kendi programını oluşturabilirsin.
          </p>
          <button type="button" class="odv-btn-primary" (click)="openForm()">
            <mat-icon class="icon-size-4">add</mat-icon>
            İlk Programımı Oluştur
          </button>
        </div>
      } @else {
        <div class="space-y-6">
          @for (plan of plans(); track plan.id) {
            <article class="odv-card p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
              <!-- Plan Başlığı ve Üst Bilgileri -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div class="flex items-center gap-2.5 flex-wrap">
                    <h3 class="m-0 text-lg font-black tracking-tight text-slate-900">{{ plan.title }}</h3>
                    <span class="odv-badge border text-xs" [class]="statusClass[plan.status]">{{ statusLabel[plan.status] }}</span>
                    @if (plan.trainerName) {
                      <span class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        <mat-icon class="icon-size-3.5 text-indigo-600">sports</mat-icon>
                        Antrenör: {{ plan.trainerName }}
                      </span>
                    }
                  </div>
                  <p class="m-0 mt-1 text-xs text-slate-500">
                    Başlangıç: <span class="font-medium text-slate-700">{{ date(plan.startDate) }}</span>
                    @if (plan.endDate) {
                      · Bitiş: <span class="font-medium text-slate-700">{{ date(plan.endDate) }}</span>
                    }
                    @if (plan.description) {
                      · <span class="text-slate-600">{{ plan.description }}</span>
                    }
                  </p>
                </div>

                <!-- Aksiyonlar & Oturum Sıfırlama -->
                <div class="flex items-center gap-2 self-end sm:self-center">
                  <button type="button"
                          class="odv-btn-soft !text-xs !py-1.5 !px-3 font-semibold"
                          title="Bugünkü işaretlemeleri sıfırla ve yeni antrenmana başla"
                          (click)="resetSession(plan.id)">
                    <mat-icon class="icon-size-3.5">restart_alt</mat-icon>
                    Antrenmanı Baştan Başlat
                  </button>
                  <button type="button" class="odv-icon-btn" title="Düzenle" (click)="openForm(plan)">
                    <mat-icon class="icon-size-4">edit</mat-icon>
                  </button>
                  <button type="button" class="odv-icon-btn odv-icon-btn-danger" title="Sil" (click)="remove(plan)">
                    <mat-icon class="icon-size-4">delete</mat-icon>
                  </button>
                </div>
              </div>

              <!-- İlerleme Özeti -->
              <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                <div class="flex items-center gap-2">
                  <mat-icon class="icon-size-4.5 text-indigo-600">task_alt</mat-icon>
                  <span class="text-xs font-bold text-slate-800">
                    Antrenman Durumu: {{ getCompletedCount(plan.id) }} / {{ plan.exercises.length }} Egzersiz Tamamlandı
                  </span>
                </div>
                <div class="w-full sm:w-48 bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div class="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                       [style.width.%]="getCompletionPercent(plan)"></div>
                </div>
              </div>

              <!-- Egzersiz Listesi (Bölgesel Kartlar) -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                @for (ex of plan.exercises; track $index; let i = $index) {
                  @let isDone = isExerciseCompleted(plan.id, i);
                  <div class="p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-3 relative"
                       [class.bg-emerald-50/30]="isDone"
                       [class.border-emerald-300]="isDone"
                       [class.bg-white]="!isDone"
                       [class.border-slate-200/90]="!isDone"
                       [class.hover:border-slate-300]="!isDone">
                    
                    <!-- Üst: Checkbox, Egzersiz Adı & Rozetler -->
                    <div class="flex items-start gap-3">
                      <button type="button"
                              class="w-6 h-6 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all mt-0.5"
                              [class.bg-emerald-500]="isDone"
                              [class.border-emerald-600]="isDone"
                              [class.text-white]="isDone"
                              [class.bg-slate-50]="!isDone"
                              [class.border-slate-300]="!isDone"
                              [class.hover:border-indigo-400]="!isDone"
                              (click)="toggleExercise(plan.id, i)">
                        @if (isDone) {
                          <mat-icon class="icon-size-4">check</mat-icon>
                        }
                      </button>

                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 flex-wrap mb-1">
                          @if (ex.dayName) {
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {{ ex.dayName }}
                            </span>
                          }
                          @if (ex.muscleGroup && muscleBadges[ex.muscleGroup]) {
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded border"
                                  [class]="muscleBadges[ex.muscleGroup].class">
                              {{ muscleBadges[ex.muscleGroup].label }}
                            </span>
                          }
                          @if (ex.equipmentName) {
                            <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {{ ex.equipmentName }}
                            </span>
                          }
                        </div>
                        <h4 class="m-0 text-sm font-bold text-slate-900 leading-snug" [class.line-through]="isDone" [class.text-slate-400]="isDone">
                          {{ ex.name }}
                        </h4>
                        @if (ex.notes) {
                          <p class="m-0 mt-1 text-xs text-indigo-700 italic bg-indigo-50/60 px-2 py-1 rounded border border-indigo-100">
                            💡 Direktif: {{ ex.notes }}
                          </p>
                        }
                      </div>
                    </div>

                    <!-- Alt: Set, Tekrar, Kilo ve Dinlenme Sayacı Butonu -->
                    <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-auto">
                      <div class="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        @if (ex.sets && ex.reps) {
                          <span class="px-2 py-1 bg-slate-100 rounded-md font-mono text-slate-900">{{ ex.sets }} Set × {{ ex.reps }} Tekrar</span>
                        } @else if (ex.sets) {
                          <span class="px-2 py-1 bg-slate-100 rounded-md font-mono text-slate-900">{{ ex.sets }} Set</span>
                        }
                        @if (ex.weight) {
                          <span class="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md font-mono font-bold">{{ ex.weight }} kg</span>
                        }
                      </div>

                      <button type="button"
                              class="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer"
                              [class.bg-indigo-50]="!restTimerRunning()"
                              [class.border-indigo-200]="!restTimerRunning()"
                              [class.text-indigo-700]="!restTimerRunning()"
                              [class.hover:bg-indigo-100]="!restTimerRunning()"
                              [class.bg-slate-100]="restTimerRunning()"
                              [class.border-slate-200]="restTimerRunning()"
                              [class.text-slate-500]="restTimerRunning()"
                              (click)="startRestTimer(ex.restSeconds || 60)">
                        <mat-icon class="icon-size-3.5">timer</mat-icon>
                        <span>Dinlen ({{ ex.restSeconds || 60 }} sn)</span>
                      </button>
                    </div>
                  </div>
                }
              </div>

              <!-- Notlar & Alt Footer -->
              @if (plan.notes) {
                <div class="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900">
                  <span class="font-bold">Antrenör Genel Notu:</span> {{ plan.notes }}
                </div>
              }

              <div class="flex items-center justify-end gap-2 pt-2">
                @if (plan.status === 'active') {
                  <button type="button" class="odv-btn-soft !text-xs !py-1.5 !px-3 font-semibold" (click)="setStatus(plan, 'completed')">
                    <mat-icon class="icon-size-3.5">task_alt</mat-icon>
                    Programı Tamamla
                  </button>
                } @else if (plan.status !== 'archived') {
                  <button type="button" class="odv-btn-soft !text-xs !py-1.5 !px-3 font-semibold" (click)="setStatus(plan, 'active')">
                    <mat-icon class="icon-size-3.5">play_arrow</mat-icon>
                    Aktife Al
                  </button>
                }
              </div>
            </article>
          }
        </div>
      }
    </div>

    <!-- PROGRAM OLUŞTURMA & DÜZENLEME SLIDE-OVER -->
    <app-slide-over
      [open]="drawerOpen()"
      [title]="editing() ? 'Antrenman Programını Düzenle' : 'Yeni Antrenman Programı'"
      [submitLabel]="editing() ? 'Güncellemeyi Kaydet' : 'Programı Kaydet'"
      [submitting]="submitting()"
      [errorMessage]="errorMessage()"
      (closed)="close()"
      (submitted)="submit()"
    >
      <div [formGroup]="form" class="space-y-4">
        <app-field label="Program Başlığı" [required]="true" [error]="err('title', { required: 'Program adı gerekli.' })">
          <input type="text" formControlName="title" class="odv-input" placeholder="Örn. 4 Günlük Hipertrofi / Split Programı" />
        </app-field>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <app-field label="Antrenör Adı">
            <input type="text" formControlName="trainerName" class="odv-input" placeholder="Örn. Ahmet Hoca" />
          </app-field>
          @if (editing()) {
            <app-field label="Program Durumu">
              <select formControlName="status" class="odv-input">
                <option value="active">Aktif</option>
                <option value="paused">Durduruldu</option>
                <option value="completed">Tamamlandı</option>
                <option value="archived">Arşiv</option>
              </select>
            </app-field>
          }
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <app-field label="Başlangıç Tarihi" [required]="true" [error]="err('startDate', { required: 'Tarih gerekli.' })">
            <input type="date" formControlName="startDate" class="odv-input" />
          </app-field>
          <app-field label="Bitiş Tarihi">
            <input type="date" formControlName="endDate" class="odv-input" />
          </app-field>
        </div>

        <app-field label="Program Açıklaması">
          <textarea formControlName="description" rows="2" class="odv-input resize-none" placeholder="Örn. Göğüs-Ön Kol, Sırt-Arka Kol, Omuz-Karın ve Bacak döngüsü"></textarea>
        </app-field>

        <!-- Egzersiz Yönetimi & Hazır Kütüphane -->
        <div class="pt-2 border-t border-slate-100">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h4 class="m-0 text-xs font-bold uppercase tracking-wider text-slate-700">Egzersizler</h4>
              <p class="m-0 text-[11px] text-slate-400">Kas bölgesi, makine ve set/tekrar detayları</p>
            </div>
            <button type="button" class="odv-btn-primary !text-xs !py-1.5 !px-3 font-semibold" (click)="addExercise()">
              <mat-icon class="icon-size-3.5">add</mat-icon>
              Boş Satır Ekle
            </button>
          </div>

          <!-- Hızlı Kütüphane Seçici -->
          <div class="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl mb-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <span class="text-xs font-bold text-indigo-950 flex-shrink-0">⚡ Kütüphaneden Ekle:</span>
            <select #presetSelect class="odv-input !text-xs !py-1 flex-1 bg-white" (change)="addPresetExercise(presetSelect.value); presetSelect.value = ''">
              <option value="">-- Hazır Egzersiz Seçin --</option>
              @for (preset of exercisePresets; track preset.name) {
                <option [value]="preset.name">
                  [{{ muscleGroupLabels[preset.muscleGroup!] }}] {{ preset.name }} ({{ preset.sets }}x{{ preset.reps }})
                </option>
              }
            </select>
          </div>

          <div formArrayName="exercises" class="space-y-3">
            @for (ex of exercises.controls; track ex; let i = $index) {
              <div [formGroupName]="i" class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative">
                <!-- Üst Satır: Gün Adı, Kas Grubu, Silme -->
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[11px] font-bold text-slate-500">Egzersiz #{{ i + 1 }}</span>
                  <button type="button" class="odv-icon-btn odv-icon-btn-danger !w-6 !h-6" title="Kaldır" (click)="removeExercise(i)">
                    <mat-icon class="icon-size-3.5">close</mat-icon>
                  </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input type="text" formControlName="name" placeholder="Hareket Adı (Bench Press)" class="odv-input !text-xs !px-2.5 sm:col-span-2" />
                  <select formControlName="muscleGroup" class="odv-input !text-xs !px-2 bg-white">
                    <option value="">Kas Grubu Seçin</option>
                    <option value="chest">Göğüs</option>
                    <option value="back">Sırt & Kanat</option>
                    <option value="shoulders">Omuz & Trapez</option>
                    <option value="legs">Bacak & Kalf</option>
                    <option value="arms">Kol (Biceps/Triceps)</option>
                    <option value="core">Karın & Core</option>
                    <option value="fullbody">Tüm Vücut</option>
                  </select>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input type="text" formControlName="equipmentName" placeholder="Makine / Sehpa" class="odv-input !text-xs !px-2.5 col-span-2" />
                  <input type="text" formControlName="dayName" placeholder="Gün (1. Gün)" class="odv-input !text-xs !px-2.5 col-span-2" />
                </div>

                <div class="grid grid-cols-4 gap-2">
                  <div class="text-[10px] text-slate-500">
                    <label class="block mb-0.5">Set</label>
                    <input type="number" min="1" formControlName="sets" placeholder="4" class="odv-input !text-xs !px-2" />
                  </div>
                  <div class="text-[10px] text-slate-500">
                    <label class="block mb-0.5">Tekrar</label>
                    <input type="text" formControlName="reps" placeholder="10-12" class="odv-input !text-xs !px-2" />
                  </div>
                  <div class="text-[10px] text-slate-500">
                    <label class="block mb-0.5">Ağırlık (kg)</label>
                    <input type="number" min="0" step="0.5" formControlName="weight" placeholder="kg" class="odv-input !text-xs !px-2" />
                  </div>
                  <div class="text-[10px] text-slate-500">
                    <label class="block mb-0.5">Dinlen (sn)</label>
                    <input type="number" min="0" step="5" formControlName="restSeconds" placeholder="60" class="odv-input !text-xs !px-2" />
                  </div>
                </div>

                <input type="text" formControlName="notes" placeholder="Antrenör direktifi (Örn: Zirvede 1 sn sıkıştır, son set drop)" class="odv-input !text-xs !px-2.5" />
              </div>
            }
          </div>

          @if (exercisesError()) {
            <p class="text-xs text-rose-500 mt-2 mb-0 font-medium">{{ exercisesError() }}</p>
          }
        </div>

        <app-field label="Genel Notlar">
          <textarea formControlName="notes" rows="2" class="odv-input resize-none" placeholder="Örn. Antrenmandan önce 10 dk hafif kardiyo ve dinamik esneme yapın."></textarea>
        </app-field>
      </div>
    </app-slide-over>
  `,
})
export class WorkoutPlan {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(WorkoutService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alertService = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusClass = STATUS_CLASS;
  protected readonly muscleBadges = MUSCLE_BADGES;
  protected readonly muscleGroupLabels = MUSCLE_GROUP_LABELS;
  protected readonly exercisePresets = DEFAULT_EXERCISE_LIBRARY;
  protected readonly date = formatDate;

  private readonly data = toSignal(this.service.watchPlans(), { initialValue: null });
  protected readonly plans = computed(() => {
    const list = this.data();
    return list && sortDesc(list, (p) => p.createdAt);
  });

  // Antrenman oturumu checkmark'ları (planId + '-' + exerciseIndex)
  protected readonly completedState = signal<Record<string, boolean>>({});

  // Canlı Dinlenme Kronometresi Sinyalleri
  protected readonly restSecondsLeft = signal(0);
  protected readonly restTotalSeconds = signal(60);
  protected readonly restTimerRunning = signal(false);
  protected readonly restFinishedAlert = signal(false);
  private restIntervalId: any = null;

  protected readonly restProgressPercent = computed(() => {
    const total = this.restTotalSeconds();
    if (!total) return 0;
    return Math.max(0, Math.min(100, (this.restSecondsLeft() / total) * 100));
  });

  // Slide-over & Form Sinyalleri
  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<PlanModel | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly exercisesError = signal('');

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    trainerName: [''],
    startDate: [todayInput(), [Validators.required]],
    endDate: [''],
    status: ['active' as PlanModel['status']],
    description: [''],
    notes: [''],
    exercises: this.fb.array([this.newExercise()]),
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.restIntervalId) {
        clearInterval(this.restIntervalId);
      }
    });
  }

  protected get exercises(): FormArray {
    return this.form.controls.exercises;
  }

  private newExercise(ex?: Exercise) {
    return this.fb.group({
      name: [ex?.name ?? ''],
      muscleGroup: [ex?.muscleGroup ?? ''],
      equipmentName: [ex?.equipmentName ?? ''],
      dayName: [ex?.dayName ?? ''],
      sets: [ex?.sets ?? (4 as number | null)],
      reps: [ex?.reps ?? (12 as number | string | null)],
      weight: [ex?.weight ?? (null as number | null)],
      restSeconds: [ex?.restSeconds ?? 60],
      notes: [ex?.notes ?? ''],
    });
  }

  protected err(name: 'title' | 'startDate', messages: Record<string, string>): string {
    return firstError(this.form.controls[name], messages);
  }

  protected isExerciseCompleted(planId: string, index: number): boolean {
    return !!this.completedState()[`${planId}-${index}`];
  }

  protected toggleExercise(planId: string, index: number): void {
    const key = `${planId}-${index}`;
    const cur = this.completedState();
    const nextVal = !cur[key];
    this.completedState.set({ ...cur, [key]: nextVal });
    if (nextVal) {
      this.snackBar.open('Tebrikler! Set tamamlandı 💪', '', { duration: 1500 });
    }
  }

  protected resetSession(planId: string): void {
    const cur = { ...this.completedState() };
    Object.keys(cur).forEach((k) => {
      if (k.startsWith(`${planId}-`)) {
        delete cur[k];
      }
    });
    this.completedState.set(cur);
    this.snackBar.open('Antrenman oturumu sıfırlandı. Yeni güne hazırsın!', 'Tamam', { duration: 2500 });
  }

  protected getCompletedCount(planId: string): number {
    const cur = this.completedState();
    return Object.keys(cur).filter((k) => k.startsWith(`${planId}-`) && cur[k]).length;
  }

  protected getCompletionPercent(plan: PlanModel): number {
    if (!plan.exercises.length) return 0;
    const count = this.getCompletedCount(plan.id);
    return Math.round((count / plan.exercises.length) * 100);
  }

  // --- Canlı Dinlenme Sayacı Metotları ---
  protected startRestTimer(seconds: number): void {
    if (this.restIntervalId) {
      clearInterval(this.restIntervalId);
    }
    this.restFinishedAlert.set(false);
    this.restTotalSeconds.set(seconds);
    this.restSecondsLeft.set(seconds);
    this.restTimerRunning.set(true);

    this.restIntervalId = setInterval(() => {
      const left = this.restSecondsLeft();
      if (left <= 1) {
        clearInterval(this.restIntervalId);
        this.restIntervalId = null;
        this.restSecondsLeft.set(0);
        this.restTimerRunning.set(false);
        this.restFinishedAlert.set(true);
        this.playBeep();
      } else {
        this.restSecondsLeft.set(left - 1);
      }
    }, 1000);
  }

  protected addRestTime(seconds: number): void {
    this.restSecondsLeft.update((s) => s + seconds);
    this.restTotalSeconds.update((t) => t + seconds);
  }

  protected stopRestTimer(): void {
    if (this.restIntervalId) {
      clearInterval(this.restIntervalId);
      this.restIntervalId = null;
    }
    this.restTimerRunning.set(false);
    this.restFinishedAlert.set(false);
  }

  protected formatSeconds(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  private playBeep(): void {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  // --- Form & Kütüphane ---
  protected addPresetExercise(presetName: string): void {
    if (!presetName) return;
    const found = DEFAULT_EXERCISE_LIBRARY.find((e) => e.name === presetName);
    if (found) {
      this.exercises.push(this.newExercise(found));
    }
  }

  protected addExercise(): void {
    this.exercises.push(this.newExercise());
  }

  protected removeExercise(index: number): void {
    this.exercises.removeAt(index);
  }

  protected openForm(plan: PlanModel | null = null): void {
    this.editing.set(plan);
    this.errorMessage.set('');
    this.exercisesError.set('');
    this.form.reset({
      title: plan?.title ?? '',
      trainerName: plan?.trainerName ?? '',
      startDate: plan ? toDateInput(plan.startDate) : todayInput(),
      endDate: plan ? toDateInput(plan.endDate) : '',
      status: plan?.status ?? 'active',
      description: plan?.description ?? '',
      notes: plan?.notes ?? '',
    });
    this.exercises.clear();
    for (const ex of plan?.exercises?.length ? plan.exercises : [undefined]) {
      this.exercises.push(this.newExercise(ex));
    }
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
    const exercises: Exercise[] = v.exercises
      .filter((e) => (e.name ?? '').trim())
      .map((e) => ({
        name: (e.name ?? '').trim(),
        muscleGroup: (e.muscleGroup as MuscleGroup) || undefined,
        equipmentName: (e.equipmentName ?? '').trim() || undefined,
        dayName: (e.dayName ?? '').trim() || undefined,
        sets: optionalNumber(e.sets),
        reps: e.reps != null && e.reps !== '' ? e.reps : undefined,
        weight: optionalNumber(e.weight),
        restSeconds: optionalNumber(e.restSeconds),
        notes: (e.notes ?? '').trim() || undefined,
      }));

    if (exercises.length === 0) {
      this.exercisesError.set('En az bir egzersiz eklemelisin.');
      return;
    }
    this.exercisesError.set('');
    this.submitting.set(true);
    this.errorMessage.set('');
    try {
      const payload = {
        title: v.title.trim(),
        trainerName: v.trainerName.trim() || undefined,
        description: v.description.trim(),
        notes: v.notes.trim(),
        startDate: fromDateInput(v.startDate),
        endDate: v.endDate ? fromDateInput(v.endDate) : null,
        exercises,
      };
      const current = this.editing();
      if (current) {
        await this.service.updatePlan(current.id, { ...payload, status: v.status });
      } else {
        await this.service.createPlan(payload);
      }
      this.snackBar.open(current ? 'Program güncellendi.' : 'Program oluşturuldu.', 'Kapat', { duration: 3000 });
      this.close();
    } catch {
      this.errorMessage.set('Kaydedilemedi, lütfen tekrar deneyin.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected async setStatus(plan: PlanModel, status: PlanModel['status']): Promise<void> {
    try {
      await this.service.updatePlan(plan.id, { status });
    } catch {
      this.snackBar.open('Durum güncellenemedi, tekrar deneyin.', 'Kapat', { duration: 3000 });
    }
  }

  protected async remove(plan: PlanModel): Promise<void> {
    if (!(await this.alertService.deleteConfirm(plan.title))) return;
    try {
      await this.service.deletePlan(plan.id);
      this.alertService.toastSuccess('Program silindi.');
    } catch {
      this.alertService.toastError('Program silinemedi, tekrar deneyin.');
    }
  }
}
