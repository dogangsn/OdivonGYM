import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked, DestroyRef } from '@angular/core';
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
import { formatMoney, toDateInput, todayInput } from '../../../shared/ui/ui-utils';
import { AdminPackagesService } from '../../packages/admin-packages.service';
import { AlertService } from '../../../core/services/alert.service';
import { GymPackage } from '../../../core/models/gym-package.model';
import { addMonths, gymToday } from '../../receivables/installment-math';

/** Salonun paket kaydı (id) ya da `custom`: süresi başlangıç/bitiş tarihiyle elle belirlenen, paket dışı üyelik. */
const CUSTOM = 'custom';
const CUSTOM_LABEL = 'Özel Süre';

const toKurus = (value: unknown): number => Math.round((Number(value) || 0) * 100);

const DEBT_INSTALLMENT_OPTIONS = [1, 2, 3, 4, 6, 9, 12];

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

/** ISO tarih veya Timestamp → `<input type="date">` için "yyyy-MM-dd" metni. */
function toDateInputValue(ts: UserProfile['birthDate']): string {
  return toDateInput(ts);
}

function todayInputValue(): string {
  return todayInput();
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
  private readonly packagesService = inject(AdminPackagesService);
  protected readonly branchContext = inject(BranchContextService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly alertService = inject(AlertService);

  readonly open = input(false);
  readonly member = input<UserProfile | null>(null);
  readonly closed = output<boolean>();

  protected readonly custom = CUSTOM;
  protected readonly customLabel = CUSTOM_LABEL;
  protected readonly money = formatMoney;
  protected readonly debtInstallmentOptions = DEBT_INSTALLMENT_OPTIONS;
  protected readonly paymentMethods = [
    { id: 'cash', label: 'Nakit' },
    { id: 'card', label: 'Kredi Kartı' },
    { id: 'transfer', label: 'Havale/EFT' },
  ] as const;
  /** Salonun satıştaki paketleri (Paketler ekranında tanımlanan). */
  private readonly allPackages = toSignal(this.packagesService.watchPackages(), { initialValue: [] as GymPackage[] });
  protected readonly packages = computed(() => this.allPackages().filter((p) => p.status === 'active'));
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

  protected readonly activeSafetyTab = signal<'emergency' | 'health'>('emergency');

  readonly form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    nationalId: ['', [Validators.pattern(/^[1-9]\d{10}$/)]],
    memberNumber: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+()\s-]{7,20}$/)]],
    password: [''],
    branchId: [''],
    gender: ['unspecified' as Gender],
    birthDate: [todayInputValue()],
    trainerId: ['', [Validators.required]],
    membershipStatus: ['active' as MembershipStatus],
    /** Paket kaydının id'si ya da `custom`. */
    packageKey: [CUSTOM as string],
    /** Paketin liste fiyatı; özel sürede elle girilen satış bedeli. */
    packagePrice: [0, [Validators.min(0)]],
    /** Kasaya giren tutar (yalnız yeni kayıtta); paket fiyatından azsa fark borç olur. */
    paidAmount: [0, [Validators.min(0)]],
    paymentMethod: ['cash' as 'cash' | 'card' | 'transfer'],
    debtDueDate: [''],
    debtInstallments: [1],
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

  private readonly formValues = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly hasEmergencyContact = computed(() => {
    const v = this.formValues();
    return !!(v.emergencyContactName?.trim() || v.emergencyContactPhone?.trim() || v.emergencyContactRelation?.trim());
  });

  protected readonly hasHealthInfo = computed(() => {
    const v = this.formValues();
    return !!(v.allergies?.trim() || v.chronicDiseases?.trim() || v.specialInfo?.trim());
  });

  protected readonly selectedPackage = computed(() => {
    const key = this.formValues().packageKey;
    return key && key !== CUSTOM ? (this.packages().find((p) => p.id === key) ?? null) : null;
  });

  /** Yeni kayıtta paket satışı: girilen/liste paket bedeli, kasaya giren ve kalan borç (kuruş hassasiyetinde). */
  protected readonly sale = computed(() => {
    const v = this.formValues();
    const price = toKurus(v.packagePrice);
    const paid = toKurus(v.paidAmount);
    return {
      price: price / 100,
      paid: paid / 100,
      debt: Math.max(0, price - paid) / 100,
      overpaid: paid > price,
    };
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
      // untracked: paket listesi sonradan yüklenince form sıfırlanmasın.
      const catalogue = untracked(() => this.packages());
      const pkg = editMode
        ? catalogue.find((p) => p.name === m?.packageLabel)
        : catalogue[0];
      const endDate = m?.membershipEndsAt
        ? toDateInputValue(m.membershipEndsAt)
        : addDays(startDate, pkg?.durationDays ?? 30);
      // Düzenlemede kayıtlı bedel gösterilir (eskiden her açılışta 1250'ye dönüyordu).
      const packagePrice = editMode ? (m?.packagePrice ?? pkg?.price ?? 0) : (pkg?.price ?? 0);

      const initialPassword = editMode ? '' : generatePassword();
      const memberNumber = m?.memberNumber || generate5DigitNumber();
      const birthDate = m?.birthDate ? toDateInputValue(m.birthDate) : todayInputValue();

      this.form.reset({
        displayName: m?.displayName ?? '',
        nationalId: m?.nationalId ?? '',
        memberNumber,
        email: m?.email ?? '',
        phone: m?.phone ?? '',
        password: initialPassword,
        branchId: m?.branchId ?? this.branchContext.activeBranch()?.id ?? '',
        gender: m?.gender ?? 'unspecified',
        birthDate,
        trainerId: m?.trainerId ?? '',
        membershipStatus: m?.membershipStatus ?? 'active',
        packageKey: pkg?.id ?? CUSTOM,
        packagePrice,
        paidAmount: packagePrice,
        paymentMethod: 'cash',
        debtDueDate: addMonths(gymToday(), 1),
        debtInstallments: 1,
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

  /** Paket seçilince fiyatı, tahsil edilecek tutarı ve bitiş tarihini paketten doldurur. */
  onPackageChange(key: string): void {
    this.form.controls.packageKey.setValue(key);
    const pkg = this.packages().find((p) => p.id === key);
    if (pkg) {
      this.form.controls.packagePrice.setValue(pkg.price);
      this.form.controls.paidAmount.setValue(pkg.price);
      this.form.controls.endDate.setValue(addDays(this.form.controls.startDate.value, pkg.durationDays));
    }
  }

  /** Paket bedeli kullanıcı tarafından elle değiştirilince çalışır. */
  onPackagePriceChange(val: unknown): void {
    const price = Number(val) || 0;
    this.form.controls.packagePrice.setValue(price);
    const currentPaid = this.form.controls.paidAmount.value;
    // Eğer tahsilat tutarı yeni fiyattan büyükse veya kullanıcı henüz tahsilata elle dokunmadıysa fiyatla senkronize et
    if (currentPaid > price || this.form.controls.paidAmount.pristine) {
      this.form.controls.paidAmount.setValue(price);
    }
  }

  /** Başlangıç tarihi değişince bitiş tarihini de kaydırır (özel sürede elle belirlenir). */
  onStartDateChange(value: string): void {
    this.form.controls.startDate.setValue(value);
    const pkg = this.selectedPackage();
    if (pkg) {
      this.form.controls.endDate.setValue(addDays(value, pkg.durationDays));
    }
  }

  generateAndFillPassword(): void {
    this.form.controls.password.setValue(generatePassword());
    this.hidePassword.set(false);
  }

  onNationalIdInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/\D/g, '').slice(0, 11);
    if (input.value !== clean) {
      input.value = clean;
    }
    this.form.controls.nationalId.setValue(clean);
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
      if (this.form.controls.nationalId.invalid) invalidFields.push('T.C. Kimlik No (11 Haneli)');
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
    const sale = this.sale();
    const selling = !this.isEditMode() && this.form.controls.membershipStatus.value === 'active';
    if (selling && sale.overpaid) {
      this.errorMessage.set(`Tahsil edilen tutar paket fiyatından (${this.money(sale.price)}) fazla olamaz.`);
      return;
    }
    if (selling && sale.debt > 0 && !this.form.controls.debtDueDate.value) {
      this.errorMessage.set('Kalan borç için bir vade tarihi seçin.');
      return;
    }
    this.errorMessage.set('');
    this.submitting.set(true);
    try {
      const value = this.form.getRawValue();
      const isActive = value.membershipStatus === 'active';
      const selectedPackage = this.selectedPackage();
      const currentMember = this.member();

      const branchId = value.branchId || this.branchContext.activeBranch()?.id || null;
      const branchObj = this.branches().find((b) => b.id === branchId);
      const branchName = branchObj ? branchObj.name : null;

      const trainerObj = this.trainers().find((t) => t.id === value.trainerId);
      const trainerName = trainerObj ? trainerObj.displayName : null;

      const membershipInput = {
        displayName: value.displayName.trim(),
        nationalId: value.nationalId?.trim() || null,
        memberNumber: value.memberNumber.trim(),
        phone: value.phone.trim(),
        gender: value.gender,
        birthDate: value.birthDate ? new Date(value.birthDate) : null,
        membershipStatus: value.membershipStatus,
        branchId,
        branchName,
        trainerId: value.trainerId || null,
        trainerName,
        packageLabel: isActive ? (selectedPackage?.name ?? CUSTOM_LABEL) : null,
        packagePrice: isActive ? (Number(value.packagePrice) || 0) : 0,
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
          // Paket satışı: eksik ödemeyi borç + (-) cüzdan yapar.
          sale: isActive
            ? {
                packageId: selectedPackage?.id ?? null,
                paidAmount: sale.paid,
                discount: selectedPackage ? Math.max(0, selectedPackage.price - (Number(value.packagePrice) || 0)) : undefined,
                paymentMethod: value.paymentMethod,
                debtDueDate: sale.debt > 0 ? value.debtDueDate : undefined,
                debtInstallments: sale.debt > 0 ? Number(value.debtInstallments) || 1 : undefined,
              }
            : null,
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

  async onBackdropClick(): Promise<void> {
    const confirmed = await this.alertService.confirm({
      title: 'Kaydetmeden Çıkmak İstiyor Musunuz?',
      message: 'Girdiğiniz bilgiler kaydedilmeyecektir. Çıkmak istediğinize emin misiniz?',
      icon: 'warning',
      confirmText: 'Evet, Çık',
      cancelText: 'Vazgeç',
      isDestructive: true,
    });
    if (confirmed) {
      this.cancel();
    }
  }
}
