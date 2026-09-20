import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AdminBranchesService } from './admin-branches.service';
import { GymBranch, OpeningHours } from '../../core/models/gym-branch.model';

function weeklyHours(open: string, close: string): OpeningHours[] {
  return ([0, 1, 2, 3, 4, 5, 6] as const).map((day) => ({ day, open, close, closed: false }));
}

const INPUT_CLASS =
  'w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all';
const LABEL_CLASS = 'block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5';

@Component({
  selector: 'app-branch-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50" (click)="cancel()"></div>
      <div
        class="font-sans fixed inset-y-0 right-0 max-w-lg w-full bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col border-l border-slate-200 dark:border-slate-800"
      >
        <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white m-0">
            {{ branch() ? 'Şubeyi Düzenle' : 'Yeni Şube' }}
          </h3>
          <button
            type="button"
            (click)="cancel()"
            class="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer"
          >
            <mat-icon class="icon-size-5" [svgIcon]="'heroicons_outline:x-mark'"></mat-icon>
          </button>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="flex-1 flex flex-col min-h-0">
          <div class="flex-1 overflow-y-auto p-6 space-y-4 custom-scroll">
            @if (errorMessage()) {
              <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                {{ errorMessage() }}
              </div>
            }

            <div>
              <label [class]="labelClass">Şube Adı <span class="text-rose-500">*</span></label>
              <input type="text" formControlName="name" [class]="inputClass" />
              @if (form.controls.name.invalid && form.controls.name.touched) {
                <p class="text-xs text-rose-500 mt-1 mb-0">Şube adı gerekli.</p>
              }
            </div>

            <div>
              <label [class]="labelClass">Adres <span class="text-rose-500">*</span></label>
              <input type="text" formControlName="address" [class]="inputClass" />
              @if (form.controls.address.invalid && form.controls.address.touched) {
                <p class="text-xs text-rose-500 mt-1 mb-0">Adres gerekli.</p>
              }
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label [class]="labelClass">Şehir <span class="text-rose-500">*</span></label>
                <input type="text" formControlName="city" [class]="inputClass" />
              </div>
              <div>
                <label [class]="labelClass">Posta Kodu</label>
                <input type="text" formControlName="postalCode" [class]="inputClass" />
              </div>
              <div>
                <label [class]="labelClass">Telefon <span class="text-rose-500">*</span></label>
                <input type="tel" formControlName="phone" [class]="inputClass" />
                @if (form.controls.phone.invalid && form.controls.phone.touched) {
                  <p class="text-xs text-rose-500 mt-1 mb-0">Geçerli bir telefon numarası gir.</p>
                }
              </div>
              <div>
                <label [class]="labelClass">E-posta <span class="text-rose-500">*</span></label>
                <input type="email" formControlName="email" [class]="inputClass" />
                @if (form.controls.email.invalid && form.controls.email.touched) {
                  <p class="text-xs text-rose-500 mt-1 mb-0">Geçerli bir e-posta gir.</p>
                }
              </div>
              <div>
                <label [class]="labelClass">Kapasite <span class="text-rose-500">*</span></label>
                <input type="number" min="1" formControlName="capacity" [class]="inputClass" />
              </div>
              <div>
                <label [class]="labelClass">Sorumlu</label>
                <input type="text" formControlName="managerName" [class]="inputClass" />
              </div>
              <div>
                <label [class]="labelClass">Açılış Saati</label>
                <input type="time" formControlName="openTime" [class]="inputClass" />
              </div>
              <div>
                <label [class]="labelClass">Kapanış Saati</label>
                <input type="time" formControlName="closeTime" [class]="inputClass" />
              </div>
            </div>

            <div>
              <label [class]="labelClass">Web Sitesi</label>
              <input type="url" formControlName="website" placeholder="https://" [class]="inputClass" />
            </div>

            @if (branch()) {
              <div>
                <label [class]="labelClass">Durum</label>
                <select formControlName="status" [class]="inputClass">
                  <option value="active">Açık</option>
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
              [disabled]="submitting()"
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

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    address: ['', [Validators.required]],
    city: ['', [Validators.required]],
    postalCode: [''],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+()\s-]{7,20}$/)]],
    email: ['', [Validators.required, Validators.email]],
    website: [''],
    capacity: [50, [Validators.required, Validators.min(1)]],
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
      const first = b?.openingHours?.[0];
      this.form.reset({
        name: b?.name ?? '',
        address: b?.address ?? '',
        city: b?.city ?? '',
        postalCode: b?.postalCode ?? '',
        phone: b?.phone ?? '',
        email: b?.email ?? '',
        website: b?.website ?? '',
        capacity: b?.capacity ?? 50,
        managerName: b?.managerName ?? '',
        openTime: first?.open ?? '06:00',
        closeTime: first?.close ?? '23:00',
        status: b?.status ?? 'active',
      });
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage.set('');
    this.submitting.set(true);
    try {
      const v = this.form.getRawValue();
      const common = {
        name: v.name.trim(),
        address: v.address.trim(),
        city: v.city.trim(),
        postalCode: v.postalCode.trim(),
        phone: v.phone.trim(),
        email: v.email.trim(),
        website: v.website.trim(),
        capacity: v.capacity,
        managerName: v.managerName.trim(),
        openingHours: weeklyHours(v.openTime, v.closeTime),
      };
      const current = this.branch();
      if (current) {
        await this.service.updateBranch(current.id, { ...common, features: current.features, status: v.status });
      } else {
        await this.service.createBranch({ ...common, features: [] });
      }
      this.closed.emit(true);
    } catch {
      this.errorMessage.set('Kaydedilemedi, tekrar dene.');
    } finally {
      this.submitting.set(false);
    }
  }

  cancel(): void {
    this.closed.emit(false);
  }
}
