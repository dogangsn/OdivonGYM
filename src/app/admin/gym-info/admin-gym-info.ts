import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { Field } from '../../shared/ui/field';
import { firstError, splitLines } from '../../shared/ui/ui-utils';
import { AdminGymInfoService } from './admin-gym-info.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-admin-gym-info',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeader, Field],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans">
      <app-page-header
        title="Salon Bilgileri"
        icon="business"
        description="Salon adı, iletişim bilgileri, üyelik kuralları ve genel ayarlar."
      />

      @if (loading()) {
        <p class="py-16 text-center text-sm text-slate-500 dark:text-slate-400 m-0">Yükleniyor…</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="save()" class="odv-card p-6 space-y-5 max-w-3xl">
          @if (errorMessage()) {
            <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              {{ errorMessage() }}
            </div>
          }

          <p class="m-0 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">İşletme</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <app-field label="Salon / İşletme Adı" [required]="true" [error]="err('businessName', { required: 'Salon adı gerekli.' })">
              <input type="text" formControlName="businessName" class="odv-input" />
            </app-field>
            <app-field label="İşletme Türü">
              <select formControlName="businessType" class="odv-input">
                <option value="company">Şirket</option>
                <option value="individual">Şahıs</option>
              </select>
            </app-field>
            <app-field label="Vergi No">
              <input type="text" formControlName="taxId" class="odv-input" />
            </app-field>
            <app-field label="Web Sitesi">
              <input type="url" formControlName="website" placeholder="https://" class="odv-input" />
            </app-field>
            <app-field label="E-posta" [required]="true" [error]="err('businessEmail', { required: 'E-posta gerekli.', email: 'Geçerli bir e-posta gir.' })">
              <input type="email" formControlName="businessEmail" class="odv-input" />
            </app-field>
            <app-field label="Telefon" [required]="true" [error]="err('businessPhone', { required: 'Telefon gerekli.', pattern: 'Geçerli bir telefon numarası gir.' })">
              <input type="tel" formControlName="businessPhone" class="odv-input" />
            </app-field>
          </div>

          <p class="m-0 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Üyelik Kuralları</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <app-field label="Deneme Süresi (gün)" [required]="true" [error]="err('trialDays', { required: 'Gerekli.', min: 'Negatif olamaz.' })">
              <input type="number" min="0" formControlName="trialDays" class="odv-input" />
            </app-field>
            <app-field label="Azami Dondurma (gün)">
              <input type="number" min="0" formControlName="maxFreezeDays" class="odv-input" />
            </app-field>
          </div>
          <app-field label="İptal Politikası">
            <textarea formControlName="cancellationPolicy" rows="3" class="odv-input resize-none"></textarea>
          </app-field>
          <app-field label="Kullanım Koşulları">
            <textarea formControlName="termsAndConditions" rows="4" class="odv-input resize-none"></textarea>
          </app-field>
          <app-field label="Salon Olanakları" hint="Her satıra bir madde yaz (duş, sauna, otopark…).">
            <textarea formControlName="features" rows="3" class="odv-input resize-none"></textarea>
          </app-field>

          <div class="flex justify-end pt-2">
            <button type="submit" class="odv-btn-primary" [disabled]="saving()">
              {{ saving() ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class AdminGymInfo {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AdminGymInfoService);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal('');
  private exists = false;

  protected readonly form = this.fb.nonNullable.group({
    businessName: ['', [Validators.required]],
    businessType: ['company' as 'company' | 'individual'],
    taxId: [''],
    website: [''],
    businessEmail: ['', [Validators.required, Validators.email]],
    businessPhone: ['', [Validators.required, Validators.pattern(/^[0-9+()\s-]{7,20}$/)]],
    trialDays: [7, [Validators.required, Validators.min(0)]],
    maxFreezeDays: [0],
    cancellationPolicy: [''],
    termsAndConditions: [''],
    features: [''],
  });

  constructor() {
    void this.load();
  }

  protected err(name: keyof typeof this.form.controls, messages: Record<string, string>): string {
    return firstError(this.form.controls[name], messages);
  }

  private async load(): Promise<void> {
    try {
      const info = await this.service.load();
      this.exists = info !== null;
      const profile = this.auth.profile();
      this.form.reset({
        businessName: info?.businessName ?? '',
        businessType: info?.businessType ?? 'company',
        taxId: info?.taxId ?? '',
        website: info?.website ?? '',
        businessEmail: info?.businessEmail ?? profile?.email ?? '',
        businessPhone: info?.businessPhone ?? profile?.phone ?? '',
        trialDays: info?.trialDays ?? 7,
        maxFreezeDays: info?.maxFreezeDays ?? 0,
        cancellationPolicy: info?.cancellationPolicy ?? '',
        termsAndConditions: info?.termsAndConditions ?? '',
        features: (info?.features ?? []).join('\n'),
      });
    } catch {
      this.errorMessage.set('Salon bilgileri yüklenemedi, sayfayı yenile.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set('');
    try {
      const v = this.form.getRawValue();
      await this.service.save(
        {
          businessName: v.businessName.trim(),
          businessType: v.businessType,
          taxId: v.taxId.trim(),
          website: v.website.trim(),
          businessEmail: v.businessEmail.trim(),
          businessPhone: v.businessPhone.trim(),
          trialDays: v.trialDays,
          maxFreezeDays: v.maxFreezeDays,
          cancellationPolicy: v.cancellationPolicy.trim(),
          termsAndConditions: v.termsAndConditions.trim(),
          features: splitLines(v.features),
        },
        this.exists,
      );
      this.exists = true;
      this.snackBar.open('Salon bilgileri kaydedildi.', 'Kapat', { duration: 3000 });
    } catch {
      this.errorMessage.set('Kaydedilemedi, tekrar dene.');
    } finally {
      this.saving.set(false);
    }
  }
}
