import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { GymApi } from '../../../core/api/gym.api';
import { AlertService } from '../../../core/services/alert.service';
import { LogoMark } from '../../../shared/components/logo-mark/logo-mark';

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
  private readonly gymApi = inject(GymApi);
  private readonly auth = inject(AuthService);
  private readonly alert = inject(AlertService);
  readonly transloco = inject(TranslocoService);

  readonly currentStep = signal<1 | 2 | 3 | 4 | 5>(1);
  readonly submitting = signal(false);

  // GÃ¼n SeÃ§imleri (Step 1)
  readonly workingDays = signal<DayOption[]>(JSON.parse(JSON.stringify(WEEK_DAYS)));

  // Logo YÃ¼kleme & Ã–nizleme
  readonly previewLogo = signal<string | null>(null);

  // Åube OlanaklarÄ± (Step 2)
  readonly allAmenities = AVAILABLE_FACILITY_AMENITIES;
  readonly selectedAmenities = signal<string[]>([
    'fitness',
    'cardio',
    'locker',
  ]);

  // HÄ±zlÄ± BaÅŸlangÄ±Ã§ SeÃ§imleri (Step 4)
  readonly seedDefaultPackages = signal<boolean>(true);
  readonly seedWorkoutTemplates = signal<boolean>(true);
  readonly seedDisciplines = signal<boolean>(true);

  // VarsayÄ±lan Paket FiyatlarÄ±
  readonly package1Price = signal<number>(1250);
  readonly package3Price = signal<number>(3200);
  readonly package12Price = signal<number>(9900);

  // AdÄ±m 1: Salon Bilgileri
  readonly gymForm = this.fb.nonNullable.group({
    name: [this.auth.profile()?.displayName ? `${this.auth.profile()?.displayName} Gym` : 'Odivon GYM', [Validators.required, Validators.minLength(2)]],
    phone: [this.auth.profile()?.phone || '', [Validators.required]],
    city: ['Ä°stanbul', [Validators.required]],
    address: ['Merkez Mah. Spor Cad. No: 14', [Validators.required]],
    openTime: ['07:00', [Validators.required]],
    closeTime: ['23:00', [Validators.required]],
  });

  // AdÄ±m 2: Åube Bilgileri
  readonly branchForm = this.fb.nonNullable.group({
    branchName: ['Merkez Åube', [Validators.required]],
    capacity: [250, [Validators.required, Validators.min(10)]],
    branchPhone: [this.auth.profile()?.phone || '+90 216 450 1020', [Validators.required]],
    branchAddress: ['BaÄŸdat Caddesi No: 142', [Validators.required]],
  });

  // AdÄ±m 3: Ä°lk AntrenÃ¶r / Personel (Zorunlu)
  readonly trainerForm = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required]],
    specialties: ['Fitness & Personal Training', [Validators.required]],
    notes: ['Head Coach / BaÅŸ AntrenÃ¶r'],
  });

  // Logo DosyasÄ± SeÃ§me
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

  // HÄ±zlÄ± GÃ¼n ÅablonlarÄ±
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

      await firstValueFrom(
        this.gymApi.completeOnboarding({
          gym: {
            name: gymData.name.trim(),
            phone: gymData.phone.trim(),
            city: gymData.city.trim(),
            address: gymData.address.trim(),
            openTime: gymData.openTime,
            closeTime: gymData.closeTime,
            workingDays: selectedDays,
            logoUrl: logo || null,
            features: amenities,
          },
          branch: {
            branchName: branchData.branchName.trim(),
            capacity: Number(branchData.capacity),
            branchPhone: branchData.branchPhone.trim(),
            branchAddress: branchData.branchAddress.trim(),
          },
          trainer: {
            displayName: trainerData.displayName.trim(),
            email: trainerData.email.trim().toLowerCase(),
            phone: trainerData.phone.trim(),
            specialties: trainerData.specialties,
            notes: trainerData.notes.trim(),
          },
          seedDefaultPackages: this.seedDefaultPackages(),
          package1Price: this.package1Price(),
          package3Price: this.package3Price(),
          package12Price: this.package12Price(),
          seedWorkoutTemplates: this.seedWorkoutTemplates(),
          seedDisciplines: this.seedDisciplines(),
        }),
      );
      await this.auth.refreshProfile();

      await this.alert.success(
        this.transloco.translate('tenantWizard.alerts.successTitle'),
        this.transloco.translate('tenantWizard.alerts.successDesc', { gymName: gymData.name }),
      );

      await this.router.navigateByUrl('/admin/overview');
    } catch (err) {
      console.error('Onboarding tamamlanamadÄ±:', err);
      void this.alert.error(
        this.transloco.translate('tenantWizard.alerts.errorTitle'),
        this.transloco.translate('tenantWizard.alerts.errorDesc'),
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
