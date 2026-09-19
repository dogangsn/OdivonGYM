import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, DestroyRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoService } from '@jsverse/transloco';
import { AdminMembersService } from '../admin-members.service';
import { toAuthErrorMessage } from '../../../core/auth/auth-error.util';
import { Gender, MembershipStatus, UserProfile } from '../../../core/models/user-profile.model';

/** `custom`: paket dışı, süresi admin tarafından elle (başlangıç/bitiş tarihiyle) belirlenen üyelik. */
type PackageOption = 30 | 90 | 180 | 365 | 'custom';

const PACKAGES: { label: string; days: PackageOption }[] = [
  { label: 'Aylık', days: 30 },
  { label: '3 Aylık', days: 90 },
  { label: '6 Aylık', days: 180 },
  { label: 'Yıllık', days: 365 },
  { label: 'Özel Süre', days: 'custom' },
];

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
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

/**
 * Admin panelinden manuel üye kaydı VE mevcut üye düzenleme — aynı formu
 * kullanır. Odivon Design System'in slide-over drawer deseniyle `AdminMembers`
 * içine gömülü render edilir (bkz. `.agents/skills/odivon-ui-design-system`);
 * MatDialog yerine `open`/`member` input'ları ve `closed` output'uyla kontrol
 * edilir. `member` verilmişse düzenleme modu (e-posta/şifre alanları gizlenir,
 * kayıt `updateMember` ile), verilmemişse `createMember` ile yapılır.
 *
 * Üyelik süresi artık SADECE paket gün sayısından değil, doğrudan
 * başlangıç/bitiş TARİHLERİNDEN kurulur — "Özel Süre" seçilirse (paket dışı
 * kayıt), admin bitiş tarihini elle belirler; hazır bir paket seçilirse
 * bitiş tarihi otomatik hesaplanır ama admin yine de üzerine yazıp
 * düzenleyebilir (bkz. `onPackageChange`/`onStartDateChange`).
 */
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
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input(false);
  readonly member = input<UserProfile | null>(null);
  readonly closed = output<boolean>();

  protected readonly packages = PACKAGES;
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly hidePassword = signal(true);
  protected readonly isEditMode = signal(false);

  readonly form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+()\s-]{7,20}$/)]],
    password: [''],
    gender: ['unspecified' as Gender],
    birthDate: [''],
    membershipStatus: ['active' as MembershipStatus],
    packageDays: [30 as PackageOption],
    startDate: [todayInputValue(), [Validators.required]],
    endDate: ['', [Validators.required]],
    notes: [''],
  });

  constructor() {
    // `member()` her açılışta değişir (yeni üye → null, düzenleme → kayıt) —
    // formu o anki değerlere göre sıfırdan doldur.
    effect(() => {
      const m = this.member();
      const editMode = !!m;
      this.isEditMode.set(editMode);
      this.errorMessage.set('');
      this.hidePassword.set(true);

      const startDate = m?.membershipStartsAt ? toDateInputValue(m.membershipStartsAt) : todayInputValue();
      const packageDays = this.packageDaysFor(m?.packageLabel) ?? 30;
      const endDate = m?.membershipEndsAt
        ? toDateInputValue(m.membershipEndsAt)
        : addDays(startDate, packageDays === 'custom' ? 30 : packageDays);

      this.form.reset({
        displayName: m?.displayName ?? '',
        email: m?.email ?? '',
        phone: m?.phone ?? '',
        password: '',
        gender: m?.gender ?? 'unspecified',
        birthDate: toDateInputValue(m?.birthDate),
        membershipStatus: m?.membershipStatus ?? 'active',
        packageDays,
        startDate,
        endDate,
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

  /** Hazır bir paket seçilince bitiş tarihini başlangıçtan itibaren yeniden hesaplar; "Özel Süre"de dokunmaz. */
  onPackageChange(value: string): void {
    const days = value === 'custom' ? 'custom' : (Number(value) as PackageOption);
    this.form.controls.packageDays.setValue(days);
    if (days !== 'custom') {
      this.form.controls.endDate.setValue(addDays(this.form.controls.startDate.value, days));
    }
  }

  /** Başlangıç tarihi değişince — hazır bir paket seçiliyse — bitiş tarihini de kaydırır. */
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

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage.set('');
    this.submitting.set(true);
    try {
      const value = this.form.getRawValue();
      const isActive = value.membershipStatus === 'active';
      const selectedPackage = this.packages.find((p) => p.days === value.packageDays);
      const currentMember = this.member();

      const membershipInput = {
        displayName: value.displayName.trim(),
        phone: value.phone.trim(),
        gender: value.gender,
        birthDate: value.birthDate ? new Date(value.birthDate) : null,
        membershipStatus: value.membershipStatus,
        packageLabel: isActive ? selectedPackage?.label ?? null : null,
        membershipStartDate: isActive ? new Date(value.startDate) : null,
        membershipEndDate: isActive ? new Date(value.endDate) : null,
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
