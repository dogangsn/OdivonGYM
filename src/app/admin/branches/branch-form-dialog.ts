import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminBranchesService } from './admin-branches.service';
import { GymBranch, OpeningHours, DAYS_OF_WEEK } from '../../core/models/gym-branch.model';

const INPUT_CLASS =
  'w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all';
const LABEL_CLASS = 'block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5';

@Component({
  selector: 'app-branch-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50" (click)="cancel()"></div>
      <div
        class="font-sans fixed inset-y-0 right-0 max-w-lg w-full bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col border-l border-slate-200 dark:border-slate-800"
      >
        <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <mat-icon class="icon-size-5">store</mat-icon>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white m-0">
                {{ branch() ? 'Şubeyi Düzenle' : 'Yeni Şube Ekle' }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 m-0">
                Şube detayları, çalışma saatleri ve açık günler
              </p>
            </div>
          </div>
          <button
            type="button"
            (click)="cancel()"
            class="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer border-none bg-transparent"
          >
            <mat-icon class="icon-size-5">close</mat-icon>
          </button>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="flex-1 flex flex-col min-h-0">
          <div class="flex-1 overflow-y-auto p-6 space-y-4 custom-scroll">
            @if (errorMessage()) {
              <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                {{ errorMessage() }}
              </div>
            }

            <!-- 1. ŞUBE LOGOSU YÜKLEME ALANI -->
            <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center gap-4">
              <div class="relative w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border-2 border-dashed border-indigo-300 dark:border-indigo-700 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                @if (logoUrl()) {
                  <img [src]="logoUrl()" alt="Şube Logosu" class="w-full h-full object-cover" />
                } @else {
                  <mat-icon class="icon-size-7 text-indigo-500">store</mat-icon>
                }
                @if (isPhotoProcessing()) {
                  <div class="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                    <mat-icon class="icon-size-5 text-white animate-spin">autorenew</mat-icon>
                  </div>
                }
              </div>

              <div class="flex-1 space-y-1.5">
                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Şube Logosu
                </div>
                <p class="text-[11px] text-slate-400 m-0">
                  PNG, JPG, SVG veya WEBP (Maks 5MB)
                </p>
                <div class="flex items-center gap-2 pt-0.5">
                  <input
                    type="file"
                    #logoFileInput
                    (change)="onLogoFileSelected($event)"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    class="hidden"
                  />
                  <button
                    type="button"
                    (click)="logoFileInput.click()"
                    class="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1 cursor-pointer border border-indigo-200 dark:border-indigo-800"
                  >
                    <mat-icon class="icon-size-3.5">{{ logoUrl() ? 'autorenew' : 'cloud_upload' }}</mat-icon>
                    <span>{{ logoUrl() ? 'Logoyu Değiştir' : 'Logo Yükle' }}</span>
                  </button>

                  @if (logoUrl()) {
                    <button
                      type="button"
                      (click)="removeLogo()"
                      class="px-2.5 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-500 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer border border-transparent hover:border-rose-200"
                      matTooltip="Logoyu Kaldır"
                    >
                      <mat-icon class="icon-size-3.5">delete</mat-icon>
                      <span>Kaldır</span>
                    </button>
                  }
                </div>
              </div>
            </div>

            <!-- 2. ŞUBE ADI & SORUMLU -->
            <div>
              <label [class]="labelClass">Şube Adı <span class="text-rose-500">*</span></label>
              <input type="text" formControlName="name" placeholder="Örn: Kadıköy Şubesi" [class]="inputClass" />
              @if (form.controls.name.invalid && form.controls.name.touched) {
                <p class="text-xs text-rose-500 mt-1 mb-0">Şube adı gerekli (en az 2 karakter).</p>
              }
            </div>

            <!-- 3. AÇIK OLDUĞU GÜNLER SEÇİMİ (KULLANICININ İSTEDİĞİ ÖZELLİK) -->
            <div class="space-y-2 p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80">
              <div class="flex items-center justify-between">
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 m-0">
                  Açık Olduğu Günler <span class="text-rose-500">*</span>
                </label>
                <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                  {{ selectedDays().length }} Gün Açık
                </span>
              </div>

              <!-- 7 Gün Butonları -->
              <div class="grid grid-cols-7 gap-1.5 pt-1">
                @for (d of weekDays; track d.id) {
                  <button
                    type="button"
                    (click)="toggleDay(d.id)"
                    class="py-2.5 px-1 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer"
                    [ngClass]="isDaySelected(d.id)
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-500/20'
                      : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'"
                    [title]="d.label"
                  >
                    <span>{{ d.short }}</span>
                    <mat-icon class="icon-size-3">
                      {{ isDaySelected(d.id) ? 'check' : 'close' }}
                    </mat-icon>
                  </button>
                }
              </div>

              <!-- Hızlı Seçim Kısayolları -->
              <div class="flex items-center gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span class="font-medium">Kısayol:</span>
                <button
                  type="button"
                  (click)="setAllDays()"
                  class="text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer border-none bg-transparent p-0"
                >
                  Hergün (7 Gün)
                </button>
                <span>•</span>
                <button
                  type="button"
                  (click)="setWeekdaysOnly()"
                  class="text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer border-none bg-transparent p-0"
                >
                  Hafta İçi (Pzt-Cum)
                </button>
                <span>•</span>
                <button
                  type="button"
                  (click)="setWeekdaysAndSaturday()"
                  class="text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer border-none bg-transparent p-0"
                >
                  Pzt - Cmt
                </button>
              </div>
            </div>

            <!-- 4. ÇALIŞMA SAATLERİ (AÇILIŞ - KAPANIŞ) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label [class]="labelClass">Açılış Saati <span class="text-rose-500">*</span></label>
                <input type="time" formControlName="openTime" [class]="inputClass" />
              </div>
              <div>
                <label [class]="labelClass">Kapanış Saati <span class="text-rose-500">*</span></label>
                <input type="time" formControlName="closeTime" [class]="inputClass" />
              </div>
            </div>

            <!-- 5. ADRES BİLGİLERİ -->
            <div>
              <label [class]="labelClass">Adres <span class="text-rose-500">*</span></label>
              <input type="text" formControlName="address" placeholder="Cadde, sokak, no..." [class]="inputClass" />
              @if (form.controls.address.invalid && form.controls.address.touched) {
                <p class="text-xs text-rose-500 mt-1 mb-0">Adres gerekli.</p>
              }
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label [class]="labelClass">Şehir <span class="text-rose-500">*</span></label>
                <input type="text" formControlName="city" placeholder="Örn: İstanbul" [class]="inputClass" />
              </div>
              <div>
                <label [class]="labelClass">Posta Kodu</label>
                <input type="text" formControlName="postalCode" placeholder="34720" [class]="inputClass" />
              </div>
              <div>
                <label [class]="labelClass">Telefon <span class="text-rose-500">*</span></label>
                <input type="tel" formControlName="phone" placeholder="+90 216 450 1020" [class]="inputClass" />
                @if (form.controls.phone.invalid && form.controls.phone.touched) {
                  <p class="text-xs text-rose-500 mt-1 mb-0">Geçerli bir telefon numarası gir.</p>
                }
              </div>
              <div>
                <label [class]="labelClass">E-posta <span class="text-rose-500">*</span></label>
                <input type="email" formControlName="email" placeholder="kadikoy@odivongym.com" [class]="inputClass" />
                @if (form.controls.email.invalid && form.controls.email.touched) {
                  <p class="text-xs text-rose-500 mt-1 mb-0">Geçerli bir e-posta gir.</p>
                }
              </div>
              <div>
                <label [class]="labelClass">Anlık Kapasite (Kişi) <span class="text-rose-500">*</span></label>
                <input type="number" min="1" formControlName="capacity" [class]="inputClass" />
              </div>
              <div>
                <label [class]="labelClass">Şube Müdürü / Sorumlu</label>
                <input type="text" formControlName="managerName" placeholder="Müdür adı soyadı" [class]="inputClass" />
              </div>
            </div>

            <div>
              <label [class]="labelClass">Web Sitesi</label>
              <input type="url" formControlName="website" placeholder="https://" [class]="inputClass" />
            </div>

            @if (branch()) {
              <div>
                <label [class]="labelClass">Şube Durumu</label>
                <select formControlName="status" [class]="inputClass">
                  <option value="active">Açık / Faaliyette</option>
                  <option value="maintenance">Bakımda</option>
                  <option value="closed">Kapalı</option>
                </select>
              </div>
            }
          </div>

          <div
            class="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-3"
          >
            <button
              type="button"
              (click)="cancel()"
              class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              [disabled]="submitting() || selectedDays().length === 0"
              class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
            >
              {{ submitting() ? 'Kaydediliyor…' : branch() ? 'Değişiklikleri Kaydet' : 'Şubeyi Kaydet' }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
})
export class BranchFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AdminBranchesService);

  readonly open = input(false);
  readonly branch = input<GymBranch | null>(null);
  readonly closed = output<boolean>();

  protected readonly inputClass = INPUT_CLASS;
  protected readonly labelClass = LABEL_CLASS;
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isPhotoProcessing = signal(false);

  // Logo state
  protected readonly logoUrl = signal<string>('');

  // Hafta günleri ve açık gün seçimi
  protected readonly weekDays = DAYS_OF_WEEK;
  protected readonly selectedDays = signal<number[]>([1, 2, 3, 4, 5, 6, 0]);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    address: ['', [Validators.required]],
    city: ['', [Validators.required]],
    postalCode: [''],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+()\s-]{7,20}$/)]],
    email: ['', [Validators.required, Validators.email]],
    website: [''],
    capacity: [100, [Validators.required, Validators.min(1)]],
    managerName: [''],
    openTime: ['06:00'],
    closeTime: ['23:00'],
    status: ['active' as GymBranch['status']],
  });

  constructor() {
    effect(() => {
      const b = this.branch();
      if (!this.open()) return;
      this.errorMessage.set('');

      // Set logo
      this.logoUrl.set(b?.logoUrl || '');

      // Set open days
      if (b?.openDays && b.openDays.length > 0) {
        this.selectedDays.set([...b.openDays]);
      } else if (b?.openingHours && b.openingHours.length > 0) {
        const fromHours = b.openingHours.filter((h) => !h.closed).map((h) => h.day);
        this.selectedDays.set(fromHours.length > 0 ? fromHours : [1, 2, 3, 4, 5, 6, 0]);
      } else {
        this.selectedDays.set([1, 2, 3, 4, 5, 6, 0]);
      }

      const first = b?.openingHours?.[0];
      this.form.reset({
        name: b?.name ?? '',
        address: b?.address ?? '',
        city: b?.city ?? '',
        postalCode: b?.postalCode ?? '',
        phone: b?.phone ?? '',
        email: b?.email ?? '',
        website: b?.website ?? '',
        capacity: b?.capacity ?? 100,
        managerName: b?.managerName ?? '',
        openTime: first?.open ?? '06:00',
        closeTime: first?.close ?? '23:00',
        status: b?.status ?? 'active',
      });
    });
  }

  isDaySelected(dayId: number): boolean {
    return this.selectedDays().includes(dayId);
  }

  toggleDay(dayId: number): void {
    const current = this.selectedDays();
    if (current.includes(dayId)) {
      if (current.length === 1) return; // En az 1 gün açık kalmalı
      this.selectedDays.set(current.filter((d) => d !== dayId));
    } else {
      this.selectedDays.set([...current, dayId]);
    }
  }

  setAllDays(): void {
    this.selectedDays.set([1, 2, 3, 4, 5, 6, 0]);
  }

  setWeekdaysOnly(): void {
    this.selectedDays.set([1, 2, 3, 4, 5]);
  }

  setWeekdaysAndSaturday(): void {
    this.selectedDays.set([1, 2, 3, 4, 5, 6]);
  }

  // Logo seçimi & sıkıştırma
  onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('Lütfen geçerli bir görsel dosyası seçin (PNG, JPG, SVG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage.set('Logo boyutu 5 MB\'dan küçük olmalıdır.');
      return;
    }

    this.isPhotoProcessing.set(true);
    this.errorMessage.set('');

    const reader = new FileReader();
    reader.onload = (e) => {
      // SVG dosyaları direkt DataURL olarak kullanılabilir
      if (file.type === 'image/svg+xml') {
        this.logoUrl.set(e.target?.result as string);
        this.isPhotoProcessing.set(false);
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/png', 0.9);
            this.logoUrl.set(dataUrl);
          }
        } catch {
          this.errorMessage.set('Görsel işlenirken bir sorun oluştu.');
        } finally {
          this.isPhotoProcessing.set(false);
        }
      };
      img.onerror = () => {
        this.errorMessage.set('Görsel yüklenemedi.');
        this.isPhotoProcessing.set(false);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      this.errorMessage.set('Dosya okunamadı.');
      this.isPhotoProcessing.set(false);
    };
    reader.readAsDataURL(file);
  }

  removeLogo(): void {
    this.logoUrl.set('');
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.selectedDays().length === 0) {
      this.errorMessage.set('Lütfen şubenin açık olduğu en az bir gün işaretleyin.');
      return;
    }

    this.errorMessage.set('');
    this.submitting.set(true);
    try {
      const v = this.form.getRawValue();
      const openDays = this.selectedDays();

      // Construct openingHours for 7 days
      const openingHours: OpeningHours[] = ([0, 1, 2, 3, 4, 5, 6] as const).map((day) => ({
        day,
        open: v.openTime,
        close: v.closeTime,
        closed: !openDays.includes(day),
      }));

      const common = {
        name: v.name.trim(),
        logoUrl: this.logoUrl().trim(),
        address: v.address.trim(),
        city: v.city.trim(),
        postalCode: v.postalCode.trim(),
        phone: v.phone.trim(),
        email: v.email.trim(),
        website: v.website.trim(),
        capacity: v.capacity,
        managerName: v.managerName.trim(),
        openingHours,
        openDays,
      };

      const current = this.branch();
      if (current) {
        await this.service.updateBranch(current.id, {
          ...common,
          features: current.features || [],
          status: v.status,
        });
      } else {
        await this.service.createBranch({ ...common, features: [] });
      }
      this.closed.emit(true);
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Kaydedilemedi, lütfen tekrar deneyin.');
    } finally {
      this.submitting.set(false);
    }
  }

  cancel(): void {
    this.closed.emit(false);
  }
}
