import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  Firestore,
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { AuthService } from '../../../core/auth/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { LogoMark } from '../../../shared/components/logo-mark/logo-mark';
import { SYSTEM_WORKOUT_TEMPLATES } from '../../../core/models/workout-template.model';

export interface DayOption {
  day: number;
  labelKey: string;
  shortKey: string;
  selected: boolean;
}

const WEEK_DAYS: DayOption[] = [
  { day: 1, labelKey: 'tenantWizard.days.monday', shortKey: 'tenantWizard.days.mon', selected: true },
  { day: 2, labelKey: 'tenantWizard.days.tuesday', shortKey: 'tenantWizard.days.tue', selected: true },
  { day: 3, labelKey: 'tenantWizard.days.wednesday', shortKey: 'tenantWizard.days.wed', selected: true },
  { day: 4, labelKey: 'tenantWizard.days.thursday', shortKey: 'tenantWizard.days.thu', selected: true },
  { day: 5, labelKey: 'tenantWizard.days.friday', shortKey: 'tenantWizard.days.fri', selected: true },
  { day: 6, labelKey: 'tenantWizard.days.saturday', shortKey: 'tenantWizard.days.sat', selected: true },
  { day: 0, labelKey: 'tenantWizard.days.sunday', shortKey: 'tenantWizard.days.sun', selected: true },
];

export interface FacilityAmenity {
  id: string;
  labelKey: string;
}

export const AVAILABLE_FACILITY_AMENITIES: FacilityAmenity[] = [
  { id: 'fitness', labelKey: 'tenantWizard.amenities.fitness' },
  { id: 'cardio', labelKey: 'tenantWizard.amenities.cardio' },
  { id: 'combat', labelKey: 'tenantWizard.amenities.combat' },
  { id: 'pilates', labelKey: 'tenantWizard.amenities.pilates' },
  { id: 'pool', labelKey: 'tenantWizard.amenities.pool' },
  { id: 'sauna', labelKey: 'tenantWizard.amenities.sauna' },
  { id: 'vitaminBar', labelKey: 'tenantWizard.amenities.vitaminBar' },
  { id: 'parking', labelKey: 'tenantWizard.amenities.parking' },
  { id: 'locker', labelKey: 'tenantWizard.amenities.locker' },
];

@Component({
  selector: 'app-tenant-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, MatTooltipModule, LogoMark, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tenant-wizard.html',
  styleUrl: './tenant-wizard.scss',
})
export class TenantWizard {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly alert = inject(AlertService);
  readonly transloco = inject(TranslocoService);

  readonly currentStep = signal<1 | 2 | 3 | 4 | 5>(1);
  readonly submitting = signal(false);

  // Gün Seçimleri (Step 1)
  readonly workingDays = signal<DayOption[]>(JSON.parse(JSON.stringify(WEEK_DAYS)));

  // Logo Yükleme & Önizleme
  readonly previewLogo = signal<string | null>(null);

  // Şube Olanakları (Step 2)
  readonly allAmenities = AVAILABLE_FACILITY_AMENITIES;
  readonly selectedAmenities = signal<string[]>([
    'fitness',
    'cardio',
    'locker',
  ]);

  // Hızlı Başlangıç Seçimleri (Step 4)
  readonly seedDefaultPackages = signal<boolean>(true);
  readonly seedWorkoutTemplates = signal<boolean>(true);
  readonly seedDisciplines = signal<boolean>(true);

  // Varsayılan Paket Fiyatları
  readonly package1Price = signal<number>(1250);
  readonly package3Price = signal<number>(3200);
  readonly package12Price = signal<number>(9900);

  // Adım 1: Salon Bilgileri
  readonly gymForm = this.fb.nonNullable.group({
    name: [this.auth.profile()?.displayName ? `${this.auth.profile()?.displayName} Gym` : 'Odivon GYM', [Validators.required, Validators.minLength(2)]],
    phone: [this.auth.profile()?.phone || '', [Validators.required]],
    city: ['İstanbul', [Validators.required]],
    address: ['Merkez Mah. Spor Cad. No: 14', [Validators.required]],
    openTime: ['07:00', [Validators.required]],
    closeTime: ['23:00', [Validators.required]],
  });

  // Adım 2: Şube Bilgileri
  readonly branchForm = this.fb.nonNullable.group({
    branchName: ['Merkez Şube', [Validators.required]],
    capacity: [250, [Validators.required, Validators.min(10)]],
    branchPhone: [this.auth.profile()?.phone || '+90 216 450 1020', [Validators.required]],
    branchAddress: ['Bağdat Caddesi No: 142', [Validators.required]],
  });

  // Adım 3: İlk Antrenör / Personel (Zorunlu)
  readonly trainerForm = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required]],
    specialties: ['Fitness & Personal Training', [Validators.required]],
    notes: ['Head Coach / Baş Antrenör'],
  });

  // Logo Dosyası Seçme
  onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.previewLogo.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  removeLogo(): void {
    this.previewLogo.set(null);
  }

  // Hızlı Gün Şablonları
  setDaysPreset(preset: 'all' | 'weekdays' | 'mon_sat'): void {
    this.workingDays.update((days) =>
      days.map((d) => {
        if (preset === 'all') return { ...d, selected: true };
        if (preset === 'weekdays') return { ...d, selected: d.day >= 1 && d.day <= 5 };
        if (preset === 'mon_sat') return { ...d, selected: d.day !== 0 };
        return d;
      }),
    );
  }

  toggleDay(dayIndex: number): void {
    this.workingDays.update((days) =>
      days.map((d) => (d.day === dayIndex ? { ...d, selected: !d.selected } : d)),
    );
  }

  toggleAmenity(amenity: string): void {
    this.selectedAmenities.update((list) =>
      list.includes(amenity) ? list.filter((a) => a !== amenity) : [...list, amenity],
    );
  }

  getSelectedAmenitiesSummary(): string {
    const selected = this.selectedAmenities();
    const labels = selected
      .map((id) => {
        const found = this.allAmenities.find((a) => a.id === id);
        return found ? this.transloco.translate(found.labelKey) : id;
      })
      .slice(0, 3)
      .join(', ');
    return selected.length > 3 ? `${labels}...` : labels;
  }

  isStep1Valid(): boolean {
    const hasAtLeastOneDay = this.workingDays().some((d) => d.selected);
    return this.gymForm.valid && hasAtLeastOneDay;
  }

  nextStep(): void {
    if (this.currentStep() === 1) {
      if (!this.isStep1Valid()) {
        this.gymForm.markAllAsTouched();
        void this.alert.warning(this.transloco.translate('tenantWizard.alerts.step1Validation'));
        return;
      }
      this.currentStep.set(2);
    } else if (this.currentStep() === 2) {
      if (this.branchForm.invalid) {
        this.branchForm.markAllAsTouched();
        void this.alert.warning(this.transloco.translate('tenantWizard.alerts.step2Validation'));
        return;
      }
      this.currentStep.set(3);
    } else if (this.currentStep() === 3) {
      if (this.trainerForm.invalid) {
        this.trainerForm.markAllAsTouched();
        void this.alert.warning(this.transloco.translate('tenantWizard.alerts.step3Validation'));
        return;
      }
      this.currentStep.set(4);
    } else if (this.currentStep() === 4) {
      this.currentStep.set(5);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update((s) => (s - 1) as 1 | 2 | 3 | 4);
    }
  }

  async completeWizard(): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) {
      void this.alert.error(
        this.transloco.translate('tenantWizard.alerts.errorTitle'),
        this.transloco.translate('tenantWizard.alerts.tenantIdNotFound'),
      );
      return;
    }

    this.submitting.set(true);
    try {
      const gymData = this.gymForm.getRawValue();
      const branchData = this.branchForm.getRawValue();
      const trainerData = this.trainerForm.getRawValue();
      const selectedDays = this.workingDays().filter((d) => d.selected).map((d) => d.day);
      const amenities = this.selectedAmenities();
      const logo = this.previewLogo();

      // 1. gym_info kaydı
      await setDoc(
        doc(this.firestore, 'gym_info', tenantId),
        {
          tenantId,
          name: gymData.name.trim(),
          phone: gymData.phone.trim(),
          city: gymData.city.trim(),
          address: gymData.address.trim(),
          openTime: gymData.openTime,
          closeTime: gymData.closeTime,
          workingDays: selectedDays,
          logoUrl: logo || null,
          features: amenities,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      // 2. Şube kaydı / güncelleme
      const branchesSnap = await getDocs(
        query(collection(this.firestore, 'gym_branches'), where('tenantId', '==', tenantId)),
      );

      let branchId: string;
      if (!branchesSnap.empty) {
        branchId = branchesSnap.docs[0].id;
        await updateDoc(doc(this.firestore, 'gym_branches', branchId), {
          name: branchData.branchName.trim(),
          capacity: Number(branchData.capacity),
          phone: branchData.branchPhone.trim(),
          address: branchData.branchAddress.trim(),
          logoUrl: logo || null,
          openDays: selectedDays,
          features: amenities,
          updatedAt: serverTimestamp(),
        });
      } else {
        const branchRef = await addDoc(collection(this.firestore, 'gym_branches'), {
          tenantId,
          name: branchData.branchName.trim(),
          capacity: Number(branchData.capacity),
          phone: branchData.branchPhone.trim(),
          address: branchData.branchAddress.trim(),
          city: gymData.city.trim(),
          status: 'active',
          currentOccupancy: 0,
          logoUrl: logo || null,
          openDays: selectedDays,
          openingHours: ([0, 1, 2, 3, 4, 5, 6] as const).map((day) => ({
            day,
            open: gymData.openTime,
            close: gymData.closeTime,
            closed: !selectedDays.includes(day),
          })),
          features: amenities,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        branchId = branchRef.id;
      }

      // 3. İlk Antrenör kaydı (gym_staff)
      const now = new Date().toISOString();
      await addDoc(collection(this.firestore, 'gym_staff'), {
        tenantId,
        displayName: trainerData.displayName.trim(),
        email: trainerData.email.trim().toLowerCase(),
        phone: trainerData.phone.trim(),
        role: 'trainer',
        title: 'Baş Antrenör / PT',
        status: 'active',
        specialties: trainerData.specialties.split(',').map((s) => s.trim()).filter(Boolean),
        branchId,
        branchName: branchData.branchName.trim(),
        hireDate: now.slice(0, 10),
        emergencyContact: '',
        monthlySalary: 0,
        commissionRate: 15,
        notes: trainerData.notes.trim(),
        customPermissions: ['workouts:manage', 'measurements:manage', 'wizard:access', 'classes:manage', 'appointments:manage'],
        createdAt: now,
        updatedAt: now,
        createdAtTimestamp: serverTimestamp(),
      });

      // 4. Varsayılan Üyelik Paketleri Tohumlama (Opsiyonel)
      if (this.seedDefaultPackages()) {
        const batch = writeBatch(this.firestore);
        const pkgCol = collection(this.firestore, 'gym_packages');

        const initialPackages = [
          {
            name: '1 Aylık Standart Üyelik',
            price: this.package1Price(),
            durationDays: 30,
            description: 'Tüm fitness alanı, soyunma odaları ve serbest ağırlık erişimi.',
            features: ['Fitness Alanı', 'Soyunma Odası & Duş', 'Mobil Turnike QR Geçişi'],
          },
          {
            name: '3 Aylık Avantajlı Paket',
            price: this.package3Price(),
            durationDays: 90,
            description: 'En popüler paket! 3 ay boyunca kesintisiz salon ve grup dersi erişimi.',
            features: ['Fitness Alanı', 'Soyunma Odası & Duş', 'Mobil Turnike QR', '1 Seans Antrenör Tanışma'],
          },
          {
            name: '1 Yıllık VIP Sınırsız',
            price: this.package12Price(),
            durationDays: 365,
            description: 'Yıl boyu sınırsız erişim, özel dolap ve tüm tesis olanakları.',
            features: ['Tüm Şubelerde Geçerli', 'Sınırsız Turnike Girişi', 'VIP Dolap', '2 Seans Birebir PT Dersi'],
          },
        ];

        for (const p of initialPackages) {
          const docRef = doc(pkgCol);
          batch.set(docRef, {
            ...p,
            id: docRef.id,
            tenantId,
            status: 'active',
            branchId,
            branchName: branchData.branchName.trim(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }

      // 5. Hazır Antrenman Şablonları Tohumlama (Opsiyonel)
      if (this.seedWorkoutTemplates()) {
        const batchTpl = writeBatch(this.firestore);
        const tplCol = collection(this.firestore, 'workout_templates');

        for (const tpl of SYSTEM_WORKOUT_TEMPLATES) {
          const docRef = doc(tplCol);
          batchTpl.set(docRef, {
            ...tpl,
            id: docRef.id,
            tenantId,
            isSystemDefault: false,
            createdByTrainerName: trainerData.displayName.trim() || 'Baş Antrenör',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batchTpl.commit();
      }

      // 6. Hazır Spor Branşları Tohumlama (Opsiyonel)
      if (this.seedDisciplines()) {
        const batchDisc = writeBatch(this.firestore);
        const discCol = collection(this.firestore, 'sports_disciplines');

        const defaultDisciplines = [
          { name: 'Fitness & Vücut Geliştirme', code: 'FIT', description: 'Serbest ağırlık, makineler ve hipertrofi antrenmanı.' },
          { name: 'Kickboks & Boks', code: 'BOX', description: 'Dövüş sporları, torba ve teknik kombinasyon seansları.' },
          { name: 'Reformer Pilates', code: 'PIL', description: 'Esneklik, core güçlendirme ve postür düzeltme.' },
        ];

        for (const disc of defaultDisciplines) {
          const docRef = doc(discCol);
          batchDisc.set(docRef, {
            ...disc,
            id: docRef.id,
            tenantId,
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batchDisc.commit();
      }

      // 7. Tenant Onboarding Completed işaretleme
      await updateDoc(doc(this.firestore, 'tenants', tenantId), {
        onboardingCompleted: true,
        name: gymData.name.trim(),
        logoUrl: logo || null,
        updatedAt: serverTimestamp(),
      });

      await this.alert.success(
        this.transloco.translate('tenantWizard.alerts.successTitle'),
        this.transloco.translate('tenantWizard.alerts.successDesc', { gymName: gymData.name }),
      );

      await this.router.navigateByUrl('/admin/overview');
    } catch (err) {
      console.error('Onboarding tamamlanamadı:', err);
      void this.alert.error(
        this.transloco.translate('tenantWizard.alerts.errorTitle'),
        this.transloco.translate('tenantWizard.alerts.errorDesc'),
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
