import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, DestroyRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';
import { AdminMembersService } from '../admin-members.service';
import { AdminStaffService } from '../../staff/admin-staff.service';
import { BranchContextService } from '../../../core/services/branch-context.service';
import { toAuthErrorMessage } from '../../../core/auth/auth-error.util';
import { Gender, MembershipStatus, UserProfile } from '../../../core/models/user-profile.model';

/** `custom`: paket dışı, süresi admin tarafından elle (başlangıç/bitiş tarihiyle) belirlenen üyelik. */
type PackageOption = 30 | 90 | 180 | 365 | 'custom';

const PACKAGES: { label: string; days: PackageOption; defaultPrice: number }[] = [
  { label: 'Aylık Standart', days: 30, defaultPrice: 1250 },
  { label: '3 Aylık Avantaj', days: 90, defaultPrice: 3200 },
  { label: '6 Aylık Pro', days: 180, defaultPrice: 5800 },
  { label: 'Yıllık VIP', days: 365, defaultPrice: 9900 },
  { label: 'Özel Süre', days: 'custom', defaultPrice: 0 },
];

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function generate5DigitNumber(): string {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

/** Firestore Timestamp → `<input type="date">` için "yyyy-MM-dd" metni. */
function toDateInputValue(ts: UserProfile['birthDate']): string {
  if (!ts) return '';
  const d = ts.toDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayInputValue(): string {
  return toDateInputValue({ toDate: () => new Date() } as UserProfile['birthDate']);
}

function addDays(dateStr: string, days: number): string {
  const base = dateStr ? new Date(dateStr) : new Date();
  base.setDate(base.getDate() + days);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-member-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './member-form-dialog.html',
  styleUrl: './member-form-dialog.scss',
})
export class MemberFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly membersService = inject(AdminMembersService);
  private readonly staffService = inject(AdminStaffService);
  protected readonly branchContext = inject(BranchContextService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input(false);
  readonly member = input<UserProfile | null>(null);
  readonly closed = output<boolean>();

  protected readonly packages = PACKAGES;
  protected readonly branches = this.branchContext.branches;
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly hidePassword = signal(true);
  protected readonly isEditMode = signal(false);
  protected readonly isPhotoProcessing = signal(false);
  protected readonly photoDragOver = signal(false);

  // Aktif antrenörleri listele (Zorunlu seçim için)
  protected readonly trainers = toSignal(
    this.staffService.watchStaff().pipe(
      map((staff) =>
        staff.filter((s) => s.status === 'active' || !s.status),
      ),
    ),
    { initialValue: [] },
  );

  readonly form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    memberNumber: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+()\s-]{7,20}$/)]],
    password: [''],
    branchId: [''],
    gender: ['unspecified' as Gender],
    birthDate: [''],
    trainerId: ['', [Validators.required]],
    membershipStatus: ['active' as MembershipStatus],
    packageDays: [30 as PackageOption],
    packagePrice: [1250],
    startDate: [todayInputValue(), [Validators.required]],
    endDate: ['', [Validators.required]],
    emergencyContactName: [''],
    emergencyContactPhone: [''],
    emergencyContactRelation: [''],
    bloodGroup: [''],
    allergies: [''],
    chronicDiseases: [''],
    specialInfo: [''],
    photoURL: [''],
    rfidCardNumber: [''],
    cardDepositFee: [150],
    cardDepositPaid: [false],
    notes: [''],
  });

  constructor() {
    // `member()` her açılışta değişir (yeni üye → null, düzenleme → kayıt)
    effect(() => {
      if (!this.open()) {
        return;
      }
      const m = this.member();
      const editMode = !!m;
      this.isEditMode.set(editMode);
      this.errorMessage.set('');
      this.hidePassword.set(editMode);

      const startDate = m?.membershipStartsAt ? toDateInputValue(m.membershipStartsAt) : todayInputValue();
      const packageDays = this.packageDaysFor(m?.packageLabel) ?? 30;
      const endDate = m?.membershipEndsAt
        ? toDateInputValue(m.membershipEndsAt)
        : addDays(startDate, packageDays === 'custom' ? 30 : packageDays);

      const initialPassword = editMode ? '' : generatePassword();
      const memberNumber = m?.memberNumber || generate5DigitNumber();

      this.form.reset({
        displayName: m?.displayName ?? '',
        memberNumber,
        email: m?.email ?? '',
        phone: m?.phone ?? '',
        password: initialPassword,
        branchId: m?.branchId ?? this.branchContext.activeBranch()?.id ?? '',
        gender: m?.gender ?? 'unspecified',
        birthDate: toDateInputValue(m?.birthDate),
        trainerId: m?.trainerId ?? '',
        membershipStatus: m?.membershipStatus ?? 'active',
        packageDays,
        packagePrice: 1250,
        startDate,
        endDate,
        emergencyContactName: m?.emergencyContactName ?? '',
        emergencyContactPhone: m?.emergencyContactPhone ?? '',
        emergencyContactRelation: m?.emergencyContactRelation ?? '',
        bloodGroup: m?.bloodGroup ?? '',
        allergies: m?.allergies ?? '',
        chronicDiseases: m?.chronicDiseases ?? '',
        specialInfo: m?.specialInfo ?? '',
        photoURL: m?.photoURL ?? '',
        rfidCardNumber: m?.rfidCardNumber ?? '',
        cardDepositFee: m?.cardDepositFee ?? 150,
        cardDepositPaid: m?.cardDepositPaid ?? false,
        notes: m?.notes ?? '',
      });

      if (editMode) {
        this.form.controls.email.disable();
        this.form.controls.password.clearValidators();
      } else {
        this.form.controls.email.enable();
        this.form.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
      }
      this.form.controls.password.updateValueAndValidity();
      this.updateDateValidators();

      // Üyelik statüsü değişince tarih validators'ını güncelleyin
      this.form.controls.membershipStatus.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.updateDateValidators();
        });
    });
  }

  private updateDateValidators(): void {
    const isActive = this.form.controls.membershipStatus.value === 'active';
    if (isActive) {
      this.form.controls.startDate.setValidators([Validators.required]);
      this.form.controls.endDate.setValidators([Validators.required]);
    } else {
      this.form.controls.startDate.clearValidators();
      this.form.controls.endDate.clearValidators();
    }
    this.form.controls.startDate.updateValueAndValidity();
    this.form.controls.endDate.updateValueAndValidity();
  }

  private packageDaysFor(label: string | null | undefined): PackageOption | undefined {
    return this.packages.find((p) => p.label === label)?.days;
  }

  /** Hazır bir paket seçilince bitiş tarihini ve varsayılan fiyatı hesaplar. */
  onPackageChange(value: string): void {
    const days = value === 'custom' ? 'custom' : (Number(value) as PackageOption);
    this.form.controls.packageDays.setValue(days);
    const selectedPkg = this.packages.find((p) => p.days === days);
    if (selectedPkg && selectedPkg.defaultPrice) {
      this.form.controls.packagePrice.setValue(selectedPkg.defaultPrice);
    }
    if (days !== 'custom') {
      this.form.controls.endDate.setValue(addDays(this.form.controls.startDate.value, days));
    }
  }

  /** Başlangıç tarihi değişince bitiş tarihini de kaydırır. */
  onStartDateChange(value: string): void {
    this.form.controls.startDate.setValue(value);
    const days = this.form.controls.packageDays.value;
    if (days !== 'custom') {
      this.form.controls.endDate.setValue(addDays(value, days));
    }
  }

  generateAndFillPassword(): void {
    this.form.controls.password.setValue(generatePassword());
    this.hidePassword.set(false);
  }

  onPhotoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.processPhotoFile(input.files[0]);
      input.value = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.photoDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.photoDragOver.set(false);
  }

  onPhotoDropped(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.photoDragOver.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.processPhotoFile(event.dataTransfer.files[0]);
    }
  }

  removePhoto(): void {
    this.form.controls.photoURL.setValue('');
  }

  private processPhotoFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('Lütfen geçerli bir görsel dosyası (JPG, PNG, WEBP) seçin.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage.set('Fotoğraf boyutu 5 MB\'dan küçük olmalıdır.');
      return;
    }

    this.isPhotoProcessing.set(true);
    this.errorMessage.set('');

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 360;
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
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            this.form.controls.photoURL.setValue(dataUrl);
          }
        } catch {
          this.errorMessage.set('Görsel işlenirken bir sorun oluştu.');
        } finally {
          this.isPhotoProcessing.set(false);
        }
      };
      img.onerror = () => {
        this.errorMessage.set('Görsel yüklenemedi. Lütfen geçerli bir dosya seçin.');
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

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      const invalidFields: string[] = [];
      if (this.form.controls.displayName.invalid) invalidFields.push('Ad Soyad');
      if (this.form.controls.trainerId.invalid) invalidFields.push('Sorumlu Antrenör (Zorunlu)');
      if (this.form.controls.memberNumber.invalid) invalidFields.push('5 Haneli Üye No');
      if (this.form.controls.email.invalid) invalidFields.push('E-posta');
      if (this.form.controls.phone.invalid) invalidFields.push('Telefon');
      if (this.form.controls.password.invalid) invalidFields.push('Şifre (en az 6 karakter)');
      if (this.form.controls.startDate.invalid) invalidFields.push('Başlangıç Tarihi');
      if (this.form.controls.endDate.invalid) invalidFields.push('Bitiş Tarihi');
      this.errorMessage.set(
        invalidFields.length > 0
          ? `Lütfen zorunlu alanları doldurun: ${invalidFields.join(', ')}`
          : 'Lütfen form alanlarını kontrol edin.',
      );
      return;
    }
    this.errorMessage.set('');
    this.submitting.set(true);
    try {
      const value = this.form.getRawValue();
      const isActive = value.membershipStatus === 'active';
      const selectedPackage = this.packages.find((p) => p.days === value.packageDays);
      const currentMember = this.member();

      const branchId = value.branchId || this.branchContext.activeBranch()?.id || null;
      const branchObj = this.branches().find((b) => b.id === branchId);
      const branchName = branchObj ? branchObj.name : null;

      const trainerObj = this.trainers().find((t) => t.id === value.trainerId);
      const trainerName = trainerObj ? trainerObj.displayName : null;

      const membershipInput = {
        displayName: value.displayName.trim(),
        memberNumber: value.memberNumber.trim(),
        phone: value.phone.trim(),
        gender: value.gender,
        birthDate: value.birthDate ? new Date(value.birthDate) : null,
        membershipStatus: value.membershipStatus,
        branchId,
        branchName,
        trainerId: value.trainerId || null,
        trainerName,
        packageLabel: isActive ? selectedPackage?.label ?? null : null,
        packagePrice: isActive ? value.packagePrice : 0,
        membershipStartDate: isActive ? new Date(value.startDate) : null,
        membershipEndDate: isActive ? new Date(value.endDate) : null,
        emergencyContactName: value.emergencyContactName.trim(),
        emergencyContactPhone: value.emergencyContactPhone.trim(),
        emergencyContactRelation: value.emergencyContactRelation.trim(),
        bloodGroup: value.bloodGroup || null,
        allergies: value.allergies.trim(),
        chronicDiseases: value.chronicDiseases.trim(),
        specialInfo: value.specialInfo.trim(),
        photoURL: value.photoURL.trim() || null,
        rfidCardNumber: value.rfidCardNumber.trim(),
        cardDepositFee: value.cardDepositFee,
        cardDepositPaid: value.cardDepositPaid,
        notes: value.notes.trim(),
      };

      if (this.isEditMode() && currentMember) {
        await this.membersService.updateMember(currentMember.uid, membershipInput);
      } else {
        await this.membersService.createMember({
          ...membershipInput,
          email: value.email.trim(),
          password: value.password,
        });
      }

      this.closed.emit(true);
    } catch (error) {
      this.errorMessage.set(toAuthErrorMessage(error, (key) => this.transloco.translate(key)));
    } finally {
      this.submitting.set(false);
    }
  }

  cancel(): void {
    this.closed.emit(false);
  }
}
