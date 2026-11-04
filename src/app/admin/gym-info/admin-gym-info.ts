import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { Field } from '../../shared/ui/field';
import { firstError } from '../../shared/ui/ui-utils';
import { AdminGymInfoService } from './admin-gym-info.service';
import { AuthService } from '../../core/auth/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { CreateGymInfoInput, GymInfo } from '../../core/models/gym-info.model';

export type GymInfoTab = 'general' | 'contact' | 'amenities' | 'rules' | 'legal';

export interface AmenityPreset {
  id: string;
  name: string;
  icon: string;
}

export const AMENITY_PRESETS: AmenityPreset[] = [
  { id: 'shower', name: 'Duş & Soyunma Odası', icon: 'shower' },
  { id: 'sauna', name: 'Sauna & Buhar Odası', icon: 'hot_tub' },
  { id: 'parking', name: 'Ücretsiz Otopark', icon: 'local_parking' },
  { id: 'wifi', name: 'Yüksek Hızlı Wi-Fi', icon: 'wifi' },
  { id: 'bar', name: 'Protein & Vitamin Bar', icon: 'local_cafe' },
  { id: 'pool', name: 'Kapalı Yüzme Havuzu', icon: 'pool' },
  { id: 'ring', name: 'Boks & Ring Alanı', icon: 'sports_martial_arts' },
  { id: 'pilates', name: 'Pilates & Yoga Stüdyosu', icon: 'self_improvement' },
  { id: 'weights', name: 'Serbest Ağırlık Alanı', icon: 'fitness_center' },
  { id: 'cardio', name: 'Kardiyo & Koşu Parkı', icon: 'directions_run' },
  { id: 'ac', name: 'İklimlendirme & Havalandırma', icon: 'ac_unit' },
  { id: '24_7', name: '7/24 Kesintisiz Erişim', icon: 'schedule' },
  { id: 'lockers', name: 'Şifreli Akıllı Dolaplar', icon: 'lock' },
  { id: 'inbody', name: 'InBody Vücut Analizi', icon: 'monitor_weight' },
  { id: 'pt', name: 'Kişisel Antrenör (PT)', icon: 'sports' },
  { id: 'cafe', name: 'Kafeterya & Dinlenme Alanı', icon: 'coffee' },
];

export interface WorkingDay {
  day: number; // 1: Pzt, 2: Sal, 3: Çar, 4: Per, 5: Cum, 6: Cmt, 0: Paz
  name: string;
  short: string;
}

export const DAYS_OF_WEEK: WorkingDay[] = [
  { day: 1, name: 'Pazartesi', short: 'Pzt' },
  { day: 2, name: 'Salı', short: 'Sal' },
  { day: 3, name: 'Çarşamba', short: 'Çar' },
  { day: 4, name: 'Perşembe', short: 'Per' },
  { day: 5, name: 'Cuma', short: 'Cum' },
  { day: 6, name: 'Cumartesi', short: 'Cmt' },
  { day: 0, name: 'Pazar', short: 'Paz' },
];

@Component({
  selector: 'app-admin-gym-info',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatTooltipModule,
    PageHeader,
    Field,
  ],
  templateUrl: './admin-gym-info.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminGymInfo {
  @ViewChild('fileInput') private readonly fileInput?: ElementRef<HTMLInputElement>;

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AdminGymInfoService);
  private readonly auth = inject(AuthService);
  private readonly alertService = inject(AlertService);

  protected readonly activeTab = signal<GymInfoTab>('general');
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly selectedFeatures = signal<string[]>([]);
  protected customFeatureInput = '';

  protected readonly AMENITY_PRESETS = AMENITY_PRESETS;
  protected readonly DAYS_OF_WEEK = DAYS_OF_WEEK;

  private exists = false;
  private rawLoadedInfo: GymInfo | null = null;

  protected readonly form = this.fb.nonNullable.group({
    businessName: ['', [Validators.required]],
    businessType: ['company' as 'company' | 'individual'],
    taxId: [''],
    website: [''],
    logo: [''],
    businessEmail: ['', [Validators.required, Validators.email]],
    businessPhone: ['', [Validators.required, Validators.pattern(/^[0-9+()\s-]{7,20}$/)]],
    city: [''],
    address: [''],
    openTime: ['07:00'],
    closeTime: ['23:00'],
    workingDays: this.fb.nonNullable.control<number[]>([1, 2, 3, 4, 5, 6, 0]),
    trialDays: [14, [Validators.required, Validators.min(0)]],
    maxFreezeDays: [0, [Validators.min(0)]],
    cancellationPolicy: [''],
    termsAndConditions: [''],
    features: this.fb.nonNullable.control<string[]>([]),
  });

  protected readonly logoUrl = computed(() => {
    return this.form.controls.logo.value.trim();
  });

  constructor() {
    void this.load();
  }

  setTab(tab: GymInfoTab): void {
    this.activeTab.set(tab);
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (!this.saving() && this.form.valid) {
        void this.save();
      }
    }
  }

  protected err(name: keyof typeof this.form.controls, messages: Record<string, string>): string {
    return firstError(this.form.controls[name], messages);
  }

  private async load(): Promise<void> {
    try {
      const info = await this.service.load();
      this.rawLoadedInfo = info;
      this.exists = info !== null;
      const profile = this.auth.profile();

      const loadedFeatures = info?.features ?? [
        'Duş & Soyunma Odası',
        'Serbest Ağırlık Alanı',
        'Kardiyo & Koşu Parkı',
        'Yüksek Hızlı Wi-Fi',
      ];
      this.selectedFeatures.set(loadedFeatures);

      this.form.reset({
        businessName: info?.businessName ?? 'Gunes Gym',
        businessType: info?.businessType ?? 'company',
        taxId: info?.taxId ?? '',
        website: info?.website ?? '',
        logo: info?.logo ?? '',
        businessEmail: info?.businessEmail ?? profile?.email ?? '',
        businessPhone: info?.businessPhone ?? profile?.phone ?? '',
        city: info?.city ?? '',
        address: info?.address ?? '',
        openTime: info?.openTime ?? '07:00',
        closeTime: info?.closeTime ?? '23:00',
        workingDays: info?.workingDays ?? [1, 2, 3, 4, 5, 6, 0],
        trialDays: info?.trialDays ?? 14,
        maxFreezeDays: info?.maxFreezeDays ?? 0,
        cancellationPolicy: info?.cancellationPolicy ?? '',
        termsAndConditions: info?.termsAndConditions ?? '',
        features: loadedFeatures,
      });
    } catch {
      this.errorMessage.set('Salon bilgileri yüklenemedi. Lütfen sayfayı yenileyiniz.');
    } finally {
      this.loading.set(false);
    }
  }

  // ==========================================
  // AMENITIES / OLANAKLAR
  // ==========================================

  protected isFeatureSelected(name: string): boolean {
    const norm = name.trim().toLowerCase();
    return this.selectedFeatures().some((f) => f.trim().toLowerCase() === norm);
  }

  protected togglePreset(name: string): void {
    const norm = name.trim().toLowerCase();
    const current = [...this.selectedFeatures()];
    const index = current.findIndex((f) => f.trim().toLowerCase() === norm);

    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(name);
    }
    this.updateFeatures(current);
  }

  protected addCustomFeature(): void {
    const val = this.customFeatureInput.trim();
    if (!val) return;

    if (!this.isFeatureSelected(val)) {
      const current = [...this.selectedFeatures(), val];
      this.updateFeatures(current);
    }
    this.customFeatureInput = '';
  }

  protected removeFeature(feat: string): void {
    const norm = feat.trim().toLowerCase();
    const current = this.selectedFeatures().filter((f) => f.trim().toLowerCase() !== norm);
    this.updateFeatures(current);
  }

  protected clearAllFeatures(): void {
    this.updateFeatures([]);
  }

  private updateFeatures(feats: string[]): void {
    this.selectedFeatures.set(feats);
    this.form.controls.features.setValue(feats);
    this.form.controls.features.markAsDirty();
  }

  // ==========================================
  // WORKING DAYS
  // ==========================================

  protected isDayActive(day: number): boolean {
    return (this.form.controls.workingDays.value || []).includes(day);
  }

  protected toggleDay(day: number): void {
    const current = [...(this.form.controls.workingDays.value || [])];
    const idx = current.indexOf(day);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(day);
    }
    this.form.controls.workingDays.setValue(current);
    this.form.controls.workingDays.markAsDirty();
  }

  protected setAllWeek(): void {
    this.form.controls.workingDays.setValue([1, 2, 3, 4, 5, 6, 0]);
    this.form.controls.workingDays.markAsDirty();
  }

  protected setWeekdaysOnly(): void {
    this.form.controls.workingDays.setValue([1, 2, 3, 4, 5]);
    this.form.controls.workingDays.markAsDirty();
  }

  // ==========================================
  // LOGO ACTIONS
  // ==========================================

  protected triggerLogoUpload(): void {
    this.fileInput?.nativeElement.click();
  }

  protected onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.size > 2 * 1024 * 1024) {
        this.alertService.toastError('Logo boyutu maksimum 2 MB olabilir.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        this.form.controls.logo.setValue(dataUrl);
        this.form.controls.logo.markAsDirty();
        this.alertService.toastSuccess('Logo görseli yüklendi.');
      };
      reader.readAsDataURL(file);
    }
  }

  protected removeLogo(): void {
    this.form.controls.logo.setValue('');
    this.form.controls.logo.markAsDirty();
  }

  // ==========================================
  // TEMPLATES
  // ==========================================

  protected applyCancellationTemplate(type: 'standard' | 'flexible' | 'strict'): void {
    let text = '';
    if (type === 'standard') {
      text =
        'Üyelik başlangıç tarihinden itibaren 14 (on dört) gün içerisinde, herhangi bir gerekçe göstermeksizin cayma ve ücret iadesi talep edilebilir. 14 günü aşan sürelerde kullanılan günler mahsup edilerek işlem yapılır.';
    } else if (type === 'flexible') {
      text =
        'Sağlık raporu veya şehir değişikliği gibi mücbir sebeplerle talep edilen üyelik iptallerinde, kalan bakiye dondurulabilir veya başka bir sporcuya devredilebilir. Nakit iade yapılmaz.';
    } else {
      text =
        'Kayıt işlemi tamamlanan ve aktifleşen üyelik paketlerinde ücret iadesi yapılmamaktadır. Üye, haklarını salon yönetiminin onayı ile 1 (bir) defaya mahsus 3. şahıslara devredebilir.';
    }
    this.form.controls.cancellationPolicy.setValue(text);
    this.form.controls.cancellationPolicy.markAsDirty();
    this.alertService.toastInfo('İptal politikası şablonu uygulandı.');
  }

  protected applyTermsTemplate(): void {
    const terms =
      '1. GENEL KURALLAR: Üyeler salon içerisinde temiz spor ayakkabısı ve uygun spor kıyafeti kullanmak zorundadır.\n' +
      '2. HİJYEN VE HAVLU: Ağırlık ve kardiyo istasyonlarında havlu kullanımı zorunludur.\n' +
      '3. EKİPMAN KULLANIMI: Kullanılan serbest ağırlıklar (dambıl, plaka) ve ekipmanlar antrenman bitiminde ait oldukları raflara bırakılmalıdır.\n' +
      '4. DOLAP VE GÜVENLİK: Günlük soyunma dolapları antrenman süresince kullanılmalı, salon kapanışında boşaltılmalıdır. Değerli eşyaların kaybından salon yönetimi sorumlu tutulamaz.\n' +
      '5. SAĞLIK BEYANI: Üye, spor yapmasına engel teşkil edecek herhangi bir sağlık sorunu olmadığını beyan ve taahhüt eder.';
    this.form.controls.termsAndConditions.setValue(terms);
    this.form.controls.termsAndConditions.markAsDirty();
    this.alertService.toastInfo('Standart sözleşme maddeleri uygulandı.');
  }

  // ==========================================
  // REVERT & SAVE
  // ==========================================

  protected revertChanges(): void {
    const info = this.rawLoadedInfo;
    const profile = this.auth.profile();
    const loadedFeatures = info?.features ?? [
      'Duş & Soyunma Odası',
      'Serbest Ağırlık Alanı',
      'Kardiyo & Koşu Parkı',
      'Yüksek Hızlı Wi-Fi',
    ];
    this.selectedFeatures.set(loadedFeatures);

    this.form.reset({
      businessName: info?.businessName ?? 'Gunes Gym',
      businessType: info?.businessType ?? 'company',
      taxId: info?.taxId ?? '',
      website: info?.website ?? '',
      logo: info?.logo ?? '',
      businessEmail: info?.businessEmail ?? profile?.email ?? '',
      businessPhone: info?.businessPhone ?? profile?.phone ?? '',
      city: info?.city ?? '',
      address: info?.address ?? '',
      openTime: info?.openTime ?? '07:00',
      closeTime: info?.closeTime ?? '23:00',
      workingDays: info?.workingDays ?? [1, 2, 3, 4, 5, 6, 0],
      trialDays: info?.trialDays ?? 14,
      maxFreezeDays: info?.maxFreezeDays ?? 0,
      cancellationPolicy: info?.cancellationPolicy ?? '',
      termsAndConditions: info?.termsAndConditions ?? '',
      features: loadedFeatures,
    });
    this.alertService.toastInfo('Değişiklikler geri alındı.');
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      this.alertService.toastError('Lütfen zorunlu alanları eksiksiz doldurun.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set('');

    try {
      const v = this.form.getRawValue();
      const payload: CreateGymInfoInput = {
        businessName: v.businessName.trim(),
        businessType: v.businessType,
        taxId: v.taxId.trim() || undefined,
        website: v.website.trim() || undefined,
        logo: v.logo.trim() || undefined,
        businessEmail: v.businessEmail.trim(),
        businessPhone: v.businessPhone.trim(),
        city: v.city.trim() || undefined,
        address: v.address.trim() || undefined,
        openTime: v.openTime || undefined,
        closeTime: v.closeTime || undefined,
        workingDays: v.workingDays,
        trialDays: Number(v.trialDays) || 0,
        maxFreezeDays: Number(v.maxFreezeDays) || 0,
        cancellationPolicy: v.cancellationPolicy.trim() || undefined,
        termsAndConditions: v.termsAndConditions.trim() || undefined,
        features: this.selectedFeatures(),
      };

      await this.service.save(payload, this.exists);
      this.exists = true;
      this.rawLoadedInfo = {
        ...(this.rawLoadedInfo ?? {
          id: '',
          tenantId: '',
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }),
        ...payload,
      };
      this.form.markAsPristine();
      this.alertService.toastSuccess('Salon ve kulüp bilgileri başarıyla kaydedildi.');
    } catch {
      this.errorMessage.set('Salon bilgileri kaydedilemedi. Lütfen tekrar deneyiniz.');
      this.alertService.toastError('Kaydetme işlemi başarısız oldu.');
    } finally {
      this.saving.set(false);
    }
  }

  protected getInitials(name?: string): string {
    if (!name) return 'GYM';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
}
