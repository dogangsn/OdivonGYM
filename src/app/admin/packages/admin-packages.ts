import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SlideOver } from '../../shared/ui/slide-over';
import { Field } from '../../shared/ui/field';
import { firstError, formatMoney, splitLines } from '../../shared/ui/ui-utils';
import { AdminPackagesService } from './admin-packages.service';
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

@Component({
  selector: 'app-admin-packages',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, PageHeader, SlideOver, Field],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans">
      <app-page-header
        title="Paket & Fiyatlandırma"
        icon="sell"
        description="Üyelik paketlerini oluştur, düzenle, fiyatlandır — üyelerin Paketler sayfasında gördüğü liste burada yönetilir."
      >
        <button actions type="button" class="odv-btn-primary" (click)="openForm()">
          <mat-icon class="icon-size-4.5">add</mat-icon>
          Yeni Paket
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
                  <th class="odv-th">Paket</th>
                  <th class="odv-th">Süre</th>
                  <th class="odv-th">Fiyat</th>
                  <th class="odv-th">Durum</th>
                  <th class="odv-th text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
                @for (p of packages(); track p.id) {
                  <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td class="odv-td">
                      <p class="font-bold text-slate-900 dark:text-white m-0">{{ p.name }}</p>
                      @if (p.features.length) {
                        <p class="text-[11px] text-slate-400 m-0">{{ p.features.join(' · ') }}</p>
                      }
                    </td>
                    <td class="odv-td text-slate-600 dark:text-slate-300 whitespace-nowrap">{{ p.durationDays }} gün</td>
                    <td class="odv-td font-semibold text-slate-900 dark:text-white whitespace-nowrap">{{ money(p.price) }}</td>
                    <td class="odv-td">
                      <span class="odv-badge" [class]="statusClass[p.status]">{{ statusLabel[p.status] }}</span>
                    </td>
                    <td class="odv-td text-right whitespace-nowrap">
                      <button type="button" class="odv-icon-btn" title="Düzenle" (click)="openForm(p)">
                        <mat-icon class="icon-size-4" [svgIcon]="'heroicons_outline:pencil'"></mat-icon>
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
      [title]="editing() ? 'Paketi Düzenle' : 'Yeni Paket'"
      [submitLabel]="editing() ? 'Değişiklikleri Kaydet' : 'Paketi Kaydet'"
      [submitting]="submitting()"
      [errorMessage]="errorMessage()"
      (closed)="close()"
      (submitted)="submit()"
    >
      <div [formGroup]="form" class="space-y-4">
        <app-field label="Paket Adı" [required]="true" [error]="err('name', { required: 'Paket adı gerekli.' })">
          <input type="text" formControlName="name" class="odv-input" placeholder="Örn. 3 Aylık" />
        </app-field>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <app-field label="Süre (gün)" [required]="true" [error]="err('durationDays', { required: 'Süre gerekli.', min: 'En az 1 gün.' })">
            <input type="number" min="1" formControlName="durationDays" class="odv-input" />
          </app-field>
          <app-field label="Fiyat (₺)" [required]="true" [error]="err('price', { required: 'Fiyat gerekli.', min: 'Negatif olamaz.' })">
            <input type="number" min="0" step="0.01" formControlName="price" class="odv-input" />
          </app-field>
          <app-field label="Dondurma Hakkı (gün)">
            <input type="number" min="0" formControlName="maxFreeze" class="odv-input" />
          </app-field>
          @if (editing()) {
            <app-field label="Durum">
              <select formControlName="status" class="odv-input">
                <option value="active">Satışta</option>
                <option value="inactive">Pasif</option>
                <option value="archived">Arşiv</option>
              </select>
            </app-field>
          }
        </div>

        <app-field label="Paket İçeriği" hint="Her satıra bir madde yaz.">
          <textarea formControlName="features" rows="4" class="odv-input resize-none" placeholder="Tüm ekipmanlara erişim&#10;Grup derslerine katılım"></textarea>
        </app-field>

        <app-field label="Açıklama">
          <textarea formControlName="description" rows="2" class="odv-input resize-none"></textarea>
        </app-field>

        <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" formControlName="trialEligible" class="w-4 h-4 accent-indigo-600" />
          Deneme üyeliğinde de geçerli
        </label>
      </div>
    </app-slide-over>
  `,
})
export class AdminPackages {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AdminPackagesService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusClass = STATUS_CLASS;
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
    durationDays: [30, [Validators.required, Validators.min(1)]],
    price: [0, [Validators.required, Validators.min(0)]],
    maxFreeze: [0],
    features: [''],
    description: [''],
    trialEligible: [false],
    status: ['active' as GymPackage['status']],
  });

  protected err(name: keyof typeof this.form.controls, messages: Record<string, string>): string {
    return firstError(this.form.controls[name], messages);
  }

  protected openForm(pkg: GymPackage | null = null): void {
    this.editing.set(pkg);
    this.errorMessage.set('');
    this.form.reset({
      name: pkg?.name ?? '',
      durationDays: pkg?.durationDays ?? 30,
      price: pkg?.price ?? 0,
      maxFreeze: pkg?.maxFreeze ?? 0,
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
        durationDays: v.durationDays,
        price: v.price,
        maxFreeze: v.maxFreeze,
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
    if (!confirm(`"${pkg.name}" paketini silmek istediğine emin misin?`)) return;
    try {
      await this.service.deletePackage(pkg.id);
      this.snackBar.open('Paket silindi.', 'Kapat', { duration: 2500 });
    } catch {
      this.snackBar.open('Paket silinemedi, tekrar dene.', 'Kapat', { duration: 3000 });
    }
  }
}
