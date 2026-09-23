import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
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
} from '@angular/fire/firestore';
import { AuthService } from '../../../core/auth/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { LogoMark } from '../../../shared/components/logo-mark/logo-mark';

interface DayOption {
  day: number;
  label: string;
  short: string;
  selected: boolean;
}

const WEEK_DAYS: DayOption[] = [
  { day: 1, label: 'Pazartesi', short: 'Pzt', selected: true },
  { day: 2, label: 'Salı', short: 'Sal', selected: true },
  { day: 3, label: 'Çarşamba', short: 'Çar', selected: true },
  { day: 4, label: 'Perşembe', short: 'Per', selected: true },
  { day: 5, label: 'Cuma', short: 'Cum', selected: true },
  { day: 6, label: 'Cumartesi', short: 'Cmt', selected: true },
  { day: 0, label: 'Pazar', short: 'Paz', selected: true },
];

@Component({
  selector: 'app-tenant-wizard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatTooltipModule, LogoMark],
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

  readonly currentStep = signal<1 | 2 | 3>(1);
  readonly submitting = signal(false);

  // Gün Seçimleri (Step 1)
  readonly workingDays = signal<DayOption[]>(JSON.parse(JSON.stringify(WEEK_DAYS)));

  // Adım 1: Salon Bilgileri
  readonly gymForm = this.fb.nonNullable.group({
    name: [this.auth.profile()?.displayName ? `${this.auth.profile()?.displayName} Gym` : 'Odivon Spor Salonu', [Validators.required, Validators.minLength(2)]],
    phone: [this.auth.profile()?.phone || '', [Validators.required]],
    city: ['İstanbul', [Validators.required]],
    address: ['Merkez Mah. Spor Cad. No: 14', [Validators.required]],
    openTime: ['07:00', [Validators.required]],
    closeTime: ['23:00', [Validators.required]],
    logoUrl: [''],
  });

  // Adım 2: Şube Bilgileri
  readonly branchForm = this.fb.nonNullable.group({
    branchName: ['Kadıköy Merkez Şube', [Validators.required]],
    capacity: [250, [Validators.required, Validators.min(10)]],
    branchPhone: [this.auth.profile()?.phone || '+90 216 450 1020', [Validators.required]],
    branchAddress: ['Bağdat Caddesi No: 142, Kadıköy', [Validators.required]],
  });

  // Adım 3: İlk Antrenör / Personel (Zorunlu)
  readonly trainerForm = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required]],
    specialties: ['Fitness & Vücut Geliştirme, Fonksiyonel Antrenman', [Validators.required]],
    notes: ['Salon Baş Antrenörü'],
  });

  toggleDay(dayIndex: number): void {
    this.workingDays.update((days) =>
      days.map((d) => (d.day === dayIndex ? { ...d, selected: !d.selected } : d)),
    );
  }

  isStep1Valid(): boolean {
    const hasAtLeastOneDay = this.workingDays().some((d) => d.selected);
    return this.gymForm.valid && hasAtLeastOneDay;
  }

  nextStep(): void {
    if (this.currentStep() === 1) {
      if (!this.isStep1Valid()) {
        this.gymForm.markAllAsTouched();
        void this.alert.warning('Lütfen salon adını, çalışma saatlerini ve en az 1 açık günü seçiniz.');
        return;
      }
      this.currentStep.set(2);
    } else if (this.currentStep() === 2) {
      if (this.branchForm.invalid) {
        this.branchForm.markAllAsTouched();
        void this.alert.warning('Lütfen şube adı ve kapasite bilgilerini doldurunuz.');
        return;
      }
      this.currentStep.set(3);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update((s) => (s - 1) as 1 | 2);
    }
  }

  async completeWizard(): Promise<void> {
    if (this.trainerForm.invalid) {
      this.trainerForm.markAllAsTouched();
      void this.alert.warning('İlk antrenör kaydı zorunludur. Lütfen ad, e-posta ve uzmanlık bilgilerini doldurunuz.');
      return;
    }

    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) {
      void this.alert.error('Hata', 'Salon kimliği bulunamadı.');
      return;
    }

    this.submitting.set(true);
    try {
      const gymData = this.gymForm.getRawValue();
      const branchData = this.branchForm.getRawValue();
      const trainerData = this.trainerForm.getRawValue();
      const selectedDays = this.workingDays().filter((d) => d.selected).map((d) => d.day);

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
          logoUrl: gymData.logoUrl.trim() || null,
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
          openingHours: ([0, 1, 2, 3, 4, 5, 6] as const).map((day) => ({
            day,
            open: gymData.openTime,
            close: gymData.closeTime,
            closed: !selectedDays.includes(day),
          })),
          features: ['Fitness Alanı', 'Soyunma Odası', 'Duş'],
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
        commissionRate: 0,
        notes: trainerData.notes.trim(),
        customPermissions: ['workouts:manage', 'measurements:manage', 'wizard:access', 'classes:manage', 'appointments:manage'],
        createdAt: now,
        updatedAt: now,
        createdAtTimestamp: serverTimestamp(),
      });

      // 4. Tenant Onboarding Completed işaretleme
      await updateDoc(doc(this.firestore, 'tenants', tenantId), {
        onboardingCompleted: true,
        name: gymData.name.trim(),
        updatedAt: serverTimestamp(),
      });

      await this.alert.success(
        'Kurulum Tamamlandı!',
        `Tebrikler! ${gymData.name} başarıyla kuruldu. Yönetim panelinize yönlendiriliyorsunuz.`,
      );

      await this.router.navigateByUrl('/dashboard');
    } catch (err) {
      console.error('Onboarding tamamlanamadı:', err);
      void this.alert.error('Hata', 'Kurulum kaydedilirken bir sorun oluştu. Lütfen tekrar deneyin.');
    } finally {
      this.submitting.set(false);
    }
  }
}
