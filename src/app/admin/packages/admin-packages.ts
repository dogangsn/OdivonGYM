import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertService } from '../../core/services/alert.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SlideOver } from '../../shared/ui/slide-over';
import { Field } from '../../shared/ui/field';
import { firstError, formatMoney, splitLines } from '../../shared/ui/ui-utils';
import { AdminPackagesService } from './admin-packages.service';
import { AdminDisciplinesService } from '../disciplines/admin-disciplines.service';
import { GymPackage } from '../../core/models/gym-package.model';

const STATUS_LABEL: Record<GymPackage['status'], string> = {
  active: 'Satışta',
  inactive: 'Pasif',
  archived: 'Arşiv',
};

const STATUS_CLASS: Record<GymPackage['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/40',
  inactive: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/40',
  archived: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

const CATEGORIES = [
  'Genel Fitness & Gym',
  'Pilates & Reformer',
  'Özel Ders (PT)',
  'VIP & Full Erişim',
  'Havuz & Spa',
  'Grup Seansları',
  'Boks & Dövüş Sporları',
  'Öğrenci & İndirimli',
];

const DAYS_OF_WEEK = [
  { id: 1, label: 'Pazartesi', short: 'Pzt' },
  { id: 2, label: 'Salı', short: 'Sal' },
  { id: 3, label: 'Çarşamba', short: 'Çar' },
  { id: 4, label: 'Perşembe', short: 'Per' },
  { id: 5, label: 'Cuma', short: 'Cum' },
  { id: 6, label: 'Cumartesi', short: 'Cmt' },
  { id: 7, label: 'Pazar', short: 'Paz' },
];

@Component({
  selector: 'app-admin-packages',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, PageHeader, SlideOver, Field],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans">
      <app-page-header
        title="Paket & Fiyatlandırma Yönetimi"
        icon="sell"
        description="Üyelik paketleri, kategori, seans limitleri, giriş-çıkış saatleri, barkod ve süre kurallarını yönetin."
      >
        <button actions type="button" class="odv-btn-primary" (click)="openForm()">
          <mat-icon class="icon-size-4.5">add</mat-icon>
          Yeni Paket Ekle
        </button>
      </app-page-header>

      <div class="odv-card overflow-hidden">
        @if (loading()) {
          <p class="py-16 text-center text-sm text-slate-500 dark:text-slate-400 m-0">Yükleniyor…</p>
        } @else if (packages().length === 0) {
          <div class="py-16 text-center">
            <p class="text-sm text-slate-500 dark:text-slate-400 m-0">Henüz paket eklenmedi.</p>
            <button type="button" class="odv-btn-soft mt-4" (click)="openForm()">+ İlk Paketi Ekle</button>
          </div>
        } @else {
          <div class="overflow-x-auto custom-scroll">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                  <th class="odv-th">Paket & Kategori</th>
                  <th class="odv-th">Süre</th>
                  <th class="odv-th">Seans & Saat & Gün</th>
                  <th class="odv-th">Barkod</th>
                  <th class="odv-th">Fiyat</th>
                  <th class="odv-th">Durum</th>
                  <th class="odv-th text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
                @for (p of packages(); track p.id) {
                  <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td class="odv-td">
                      <div class="flex items-center gap-2">
                        <p class="font-bold text-slate-900 dark:text-white m-0">{{ p.name }}</p>
                        @if (p.isHidden) {
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            Gizli
                          </span>
                        }
                      </div>
                      <div class="flex items-center gap-2 mt-0.5">
                        <span class="inline-flex items-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                          {{ p.category || 'Genel Fitness' }}
                        </span>
                        @if (p.features.length) {
                          <span class="text-[11px] text-slate-400 truncate max-w-xs">{{ p.features.join(' · ') }}</span>
                        }
                      </div>
                    </td>
                    <td class="odv-td text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      <span class="font-semibold">{{ p.durationValue || p.durationDays }} {{ getDurationLabel(p) }}</span>
                      <span class="text-[11px] text-slate-400 block">({{ p.durationDays }} gün)</span>
                    </td>
                    <td class="odv-td text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <span class="font-semibold block">
                        {{ p.isUnlimitedSessions ? 'Sınırsız Giriş' : (p.sessionCount ? p.sessionCount + ' Seans' : 'Sınırsız') }}
                      </span>
                      <span class="text-[11px] text-slate-400 block">
                        {{ p.checkInStartTime || '06:00' }} - {{ p.checkInEndTime || '23:00' }}
                      </span>
                      <span class="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 mt-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                        <mat-icon class="icon-size-3 text-indigo-500">calendar_today</mat-icon>
                        {{ formatAllowedDays(p.allowedDays) }}
                      </span>
                    </td>
                    <td class="odv-td text-slate-500 font-mono text-xs whitespace-nowrap">
                      {{ p.barcode || '—' }}
                    </td>
                    <td class="odv-td font-black text-slate-900 dark:text-white whitespace-nowrap">
                      {{ money(p.price) }}
                    </td>
                    <td class="odv-td">
                      <span class="odv-badge" [class]="statusClass[p.status]">{{ statusLabel[p.status] }}</span>
                    </td>
                    <td class="odv-td text-right whitespace-nowrap">
                      <button type="button" class="odv-icon-btn" title="Düzenle" (click)="openForm(p)">
                        <mat-icon class="icon-size-4">edit</mat-icon>
                      </button>
                      <button type="button" class="odv-icon-btn odv-icon-btn-danger ml-1" title="Sil" (click)="remove(p)">
                        <mat-icon class="icon-size-4">delete</mat-icon>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    <app-slide-over
      [open]="drawerOpen()"
      [title]="editing() ? 'Paketi Düzenle' : 'Yeni Paket Ekle'"
      [submitLabel]="editing() ? 'Değişiklikleri Kaydet' : 'Paketi Kaydet'"
      [submitting]="submitting()"
      [errorMessage]="errorMessage()"
      (closed)="close()"
      (submitted)="submit()"
    >
      <div [formGroup]="form" class="space-y-4 font-sans">
        <app-field label="Paket Adı" [required]="true" [error]="err('name', { required: 'Paket adı gerekli.' })">
          <input type="text" formControlName="name" class="odv-input" placeholder="Örn. 3 Aylık Gold Üyelik" />
        </app-field>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <app-field label="Kategori / Spor Branşı">
            <select formControlName="category" class="odv-input">
              @for (cat of categories(); track cat) {
                <option [value]="cat">{{ cat }}</option>
              }
            </select>
          </app-field>

          <app-field label="Barkod / Paket Kodu">
            <input type="text" formControlName="barcode" class="odv-input font-mono" placeholder="Örn: PKT-3M-001" />
          </app-field>
        </div>

        <!-- SÜRE (YIL / AY / GÜN) AYARLARI -->
        <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-3">
          <p class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 m-0 flex items-center gap-1.5">
            <mat-icon class="icon-size-4 text-indigo-500">schedule</mat-icon>
            <span>Süre Yapılandırması</span>
          </p>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Birim</label>
              <select formControlName="durationType" (change)="onDurationChange()" class="odv-input">
                <option value="month">Ay</option>
                <option value="year">Yıl</option>
                <option value="day">Gün</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Miktar</label>
              <input type="number" min="1" formControlName="durationValue" (input)="onDurationChange()" class="odv-input font-bold" />
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Toplam Gün</label>
              <input type="number" readonly [value]="form.controls.durationDays.value" class="odv-input bg-slate-100 dark:bg-slate-800 font-bold text-indigo-600" />
            </div>
          </div>
        </div>

        <!-- FİYAT & DONDURMA -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <app-field label="Fiyat (₺)" [required]="true" [error]="err('price', { required: 'Fiyat gerekli.', min: 'Negatif olamaz.' })">
            <input type="number" min="0" step="0.01" formControlName="price" class="odv-input font-bold text-emerald-600" />
          </app-field>
          <app-field label="Dondurma Hakkı (gün)">
            <input type="number" min="0" formControlName="maxFreeze" class="odv-input" placeholder="0" />
          </app-field>
        </div>

        <!-- SEANS VE GİRİŞ-ÇIKIŞ SAAT KURALLARI -->
        <div class="p-3.5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 space-y-3">
          <p class="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 m-0 flex items-center gap-1.5">
            <mat-icon class="icon-size-4 text-indigo-600">door_sliding</mat-icon>
            <span>Turnike Giriş-Çıkış & Seans Kuralları</span>
          </p>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">Giriş Başlangıç Saati</label>
              <input type="time" formControlName="checkInStartTime" class="odv-input" />
            </div>
            <div>
              <label class="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">Giriş Bitiş Saati</label>
              <input type="time" formControlName="checkInEndTime" class="odv-input" />
            </div>
          </div>

          <div class="flex items-center gap-3 pt-1">
            <label class="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" formControlName="isUnlimitedSessions" class="w-4 h-4 accent-indigo-600" />
              Sınırsız Giriş / Seans
            </label>
            @if (!form.controls.isUnlimitedSessions.value) {
              <div class="flex-1 max-w-[140px]">
                <input type="number" min="1" formControlName="sessionCount" placeholder="Seans adedi" class="odv-input py-1.5 text-xs font-bold" />
              </div>
            }
          </div>
        </div>

        <!-- GEÇERLİ GÜNLER (HAFTANIN GÜNLERİ) KISITLAMASI -->
        <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 m-0 flex items-center gap-1.5">
              <mat-icon class="icon-size-4 text-indigo-500">date_range</mat-icon>
              <span>Geçerli Günler (Erişim İzni)</span>
            </p>
            <span class="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50">
              {{ formatAllowedDays(form.controls.allowedDays.value) }}
            </span>
          </div>

          <!-- Hızlı Hazır Seçimler (Presets) -->
          <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
            <button
              type="button"
              (click)="setDayPreset('all')"
              class="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border cursor-pointer"
              [class]="form.controls.allowedDays.value.length === 7 ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'"
            >
              Haftanın 7 Günü
            </button>
            <button
              type="button"
              (click)="setDayPreset('weekdays')"
              class="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border cursor-pointer"
              [class]="isPresetActive('weekdays') ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'"
            >
              Hafta İçi (5 Gün)
            </button>
            <button
              type="button"
              (click)="setDayPreset('weekend')"
              class="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border cursor-pointer"
              [class]="isPresetActive('weekend') ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'"
            >
              Hafta Sonu (2 Gün)
            </button>
            <button
              type="button"
              (click)="setDayPreset('mon_wed_fri')"
              class="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border cursor-pointer"
              [class]="isPresetActive('mon_wed_fri') ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'"
            >
              Pzt · Çar · Cum
            </button>
            <button
              type="button"
              (click)="setDayPreset('tue_thu_sat')"
              class="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border cursor-pointer"
              [class]="isPresetActive('tue_thu_sat') ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'"
            >
              Sal · Per · Cmt
            </button>
          </div>

          <!-- Gün Seçim Butonları (7 Gün Toggle) -->
          <div class="grid grid-cols-7 gap-1.5 pt-1">
            @for (day of daysOfWeek; track day.id) {
              <button
                type="button"
                (click)="toggleDay(day.id)"
                class="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center transition-all border font-sans cursor-pointer"
                [class]="isDaySelected(day.id)
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-600/20 font-bold'
                  : 'bg-white dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'"
              >
                <span class="text-xs font-black">{{ day.short }}</span>
                <span class="text-[9px] mt-0.5 opacity-80 hidden sm:inline">{{ day.label }}</span>
                @if (isDaySelected(day.id)) {
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1"></span>
                } @else {
                  <span class="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mt-1"></span>
                }
              </button>
            }
          </div>
          <p class="text-[11px] text-slate-400 dark:text-slate-500 m-0">
            * Turnike geçiş kontrolünde üyenin yalnızca bu seçilen günlerde salona girişine izin verilir.
          </p>
        </div>

        @if (editing()) {
          <app-field label="Durum">
            <select formControlName="status" class="odv-input">
              <option value="active">Satışta</option>
              <option value="inactive">Pasif</option>
              <option value="archived">Arşiv</option>
            </select>
          </app-field>
        }

        <app-field label="Paket Özellikleri" hint="Her satıra bir özellik yazınız.">
          <textarea formControlName="features" rows="3" class="odv-input resize-none" placeholder="Tüm ekipmanlara erişim&#10;Grup derslerine katılım&#10;Havuz & Spa kullanımı"></textarea>
        </app-field>

        <app-field label="Açıklama">
          <textarea formControlName="description" rows="2" class="odv-input resize-none" placeholder="Paket hakkında dahili veya satış notları"></textarea>
        </app-field>

        <!-- SEÇENEK CHECKBOX'LARI -->
        <div class="space-y-2 pt-1">
          <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" formControlName="isHidden" class="w-4 h-4 accent-indigo-600" />
            <span>Gizli Paket (Mobil/Web sitede görünmez, yalnızca resepsiyondan tanımlanabilir)</span>
          </label>

          <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" formControlName="trialEligible" class="w-4 h-4 accent-indigo-600" />
            <span>Deneme üyeliğinde de geçerli kıl</span>
          </label>
        </div>
      </div>
    </app-slide-over>
  `,
})
export class AdminPackages {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AdminPackagesService);
  private readonly disciplinesService = inject(AdminDisciplinesService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alertService = inject(AlertService);

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusClass = STATUS_CLASS;
  private readonly disciplinesList = toSignal(this.disciplinesService.watchDisciplines(), { initialValue: [] });
  protected readonly categories = computed(() => {
    const branchNames = (this.disciplinesList() ?? []).map((d) => d.name);
    return Array.from(new Set([...branchNames, ...CATEGORIES]));
  });
  protected readonly daysOfWeek = DAYS_OF_WEEK;
  protected readonly money = formatMoney;

  private readonly data = toSignal(this.service.watchPackages(), { initialValue: null });
  protected readonly loading = computed(() => this.data() === null);
  protected readonly packages = computed(() => [...(this.data() ?? [])].sort((a, b) => a.durationDays - b.durationDays));

  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<GymPackage | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    category: ['Genel Fitness & Gym'],
    barcode: [''],
    durationType: ['month' as 'day' | 'month' | 'year'],
    durationValue: [1, [Validators.required, Validators.min(1)]],
    durationDays: [30, [Validators.required, Validators.min(1)]],
    price: [0, [Validators.required, Validators.min(0)]],
    maxFreeze: [0],
    allowedDays: [[1, 2, 3, 4, 5, 6, 7] as number[]],
    isUnlimitedSessions: [true],
    sessionCount: [null as number | null],
    checkInStartTime: ['06:00'],
    checkInEndTime: ['23:00'],
    isHidden: [false],
    features: [''],
    description: [''],
    trialEligible: [false],
    status: ['active' as GymPackage['status']],
  });

  protected err(name: keyof typeof this.form.controls, messages: Record<string, string>): string {
    return firstError(this.form.controls[name], messages);
  }

  protected getDurationLabel(pkg: GymPackage): string {
    if (pkg.durationType === 'year') return 'Yıl';
    if (pkg.durationType === 'month') return 'Ay';
    return 'Gün';
  }

  protected formatAllowedDays(days?: number[]): string {
    if (!days || days.length === 0 || days.length === 7) return 'Haftanın 7 Günü';
    const sorted = [...days].sort((a, b) => a - b);
    if (sorted.length === 5 && [1, 2, 3, 4, 5].every((d, i) => d === i + 1)) {
      return 'Hafta İçi (Pzt-Cum)';
    }
    if (sorted.length === 2 && sorted[0] === 6 && sorted[1] === 7) {
      return 'Hafta Sonu (Cmt-Paz)';
    }
    const shortNames: Record<number, string> = {
      1: 'Pzt', 2: 'Sal', 3: 'Çar', 4: 'Per', 5: 'Cum', 6: 'Cmt', 7: 'Paz'
    };
    return sorted.map(d => shortNames[d] || String(d)).join(', ');
  }

  protected isDaySelected(dayId: number): boolean {
    const days = this.form.controls.allowedDays.value || [];
    return days.includes(dayId);
  }

  protected isPresetActive(preset: 'weekdays' | 'weekend' | 'mon_wed_fri' | 'tue_thu_sat'): boolean {
    const val = this.form.controls.allowedDays.value || [];
    if (preset === 'weekdays') return val.length === 5 && [1, 2, 3, 4, 5].every(d => val.includes(d));
    if (preset === 'weekend') return val.length === 2 && [6, 7].every(d => val.includes(d));
    if (preset === 'mon_wed_fri') return val.length === 3 && [1, 3, 5].every(d => val.includes(d));
    if (preset === 'tue_thu_sat') return val.length === 3 && [2, 4, 6].every(d => val.includes(d));
    return false;
  }

  protected setDayPreset(preset: 'all' | 'weekdays' | 'weekend' | 'mon_wed_fri' | 'tue_thu_sat'): void {
    let days: number[] = [];
    switch (preset) {
      case 'all':
        days = [1, 2, 3, 4, 5, 6, 7];
        break;
      case 'weekdays':
        days = [1, 2, 3, 4, 5];
        break;
      case 'weekend':
        days = [6, 7];
        break;
      case 'mon_wed_fri':
        days = [1, 3, 5];
        break;
      case 'tue_thu_sat':
        days = [2, 4, 6];
        break;
    }
    this.form.controls.allowedDays.setValue(days);
  }

  protected toggleDay(dayId: number): void {
    const current = [...(this.form.controls.allowedDays.value || [])];
    const index = current.indexOf(dayId);
    if (index > -1) {
      if (current.length === 1) {
        this.snackBar.open('En az 1 gün seçili olmalıdır.', 'Tamam', { duration: 2500 });
        return;
      }
      current.splice(index, 1);
    } else {
      current.push(dayId);
      current.sort((a, b) => a - b);
    }
    this.form.controls.allowedDays.setValue(current);
  }

  protected onDurationChange(): void {
    const type = this.form.controls.durationType.value;
    const val = Number(this.form.controls.durationValue.value) || 1;
    let days = val;
    if (type === 'month') days = val * 30;
    else if (type === 'year') days = val * 365;
    this.form.controls.durationDays.setValue(days);
  }

  protected openForm(pkg: GymPackage | null = null): void {
    this.editing.set(pkg);
    this.errorMessage.set('');
    
    const type = pkg?.durationType || (pkg?.durationDays && pkg.durationDays % 30 === 0 ? 'month' : 'day');
    const val = pkg?.durationValue || (type === 'month' && pkg?.durationDays ? Math.round(pkg.durationDays / 30) : pkg?.durationDays || 1);

    this.form.reset({
      name: pkg?.name ?? '',
      category: pkg?.category ?? 'Genel Fitness & Gym',
      barcode: pkg?.barcode ?? '',
      durationType: type,
      durationValue: val,
      durationDays: pkg?.durationDays ?? 30,
      price: pkg?.price ?? 0,
      maxFreeze: pkg?.maxFreeze ?? 0,
      allowedDays: pkg?.allowedDays && pkg.allowedDays.length > 0 ? pkg.allowedDays : [1, 2, 3, 4, 5, 6, 7],
      isUnlimitedSessions: pkg?.isUnlimitedSessions ?? true,
      sessionCount: pkg?.sessionCount ?? null,
      checkInStartTime: pkg?.checkInStartTime ?? '06:00',
      checkInEndTime: pkg?.checkInEndTime ?? '23:00',
      isHidden: pkg?.isHidden ?? false,
      features: (pkg?.features ?? []).join('\n'),
      description: pkg?.description ?? '',
      trialEligible: pkg?.trialEligible ?? false,
      status: pkg?.status ?? 'active',
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
    this.submitting.set(true);
    this.errorMessage.set('');
    try {
      const v = this.form.getRawValue();
      const payload = {
        name: v.name.trim(),
        category: v.category,
        barcode: v.barcode.trim(),
        durationType: v.durationType,
        durationValue: v.durationValue,
        durationDays: v.durationDays,
        price: v.price,
        maxFreeze: v.maxFreeze,
        allowedDays: v.allowedDays.length > 0 ? v.allowedDays : [1, 2, 3, 4, 5, 6, 7],
        isUnlimitedSessions: v.isUnlimitedSessions,
        sessionCount: v.isUnlimitedSessions ? null : v.sessionCount,
        checkInStartTime: v.checkInStartTime,
        checkInEndTime: v.checkInEndTime,
        isHidden: v.isHidden,
        features: splitLines(v.features),
        description: v.description.trim(),
        trialEligible: v.trialEligible,
      };
      const current = this.editing();
      if (current) {
        await this.service.updatePackage(current.id, { ...payload, status: v.status });
      } else {
        await this.service.createPackage(payload);
      }
      this.snackBar.open(current ? 'Paket güncellendi.' : 'Paket eklendi.', 'Kapat', { duration: 3000 });
      this.close();
    } catch {
      this.errorMessage.set('Kaydedilemedi, tekrar dene.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected async remove(pkg: GymPackage): Promise<void> {
    if (!(await this.alertService.deleteConfirm(pkg.name))) return;
    try {
      await this.service.deletePackage(pkg.id);
      this.alertService.toastSuccess('Paket silindi.');
    } catch {
      this.alertService.toastError('Paket silinemedi, tekrar dene.');
    }
  }
}
