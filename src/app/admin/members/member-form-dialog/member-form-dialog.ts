import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { AdminMembersService } from '../admin-members.service';
import { toAuthErrorMessage } from '../../../core/auth/auth-error.util';
import { UserProfile } from '../../../core/models/user-profile.model';

export interface MemberFormDialogData {
  /** Verilirse düzenleme modu; verilmezse yeni üye oluşturma modu. */
  member?: UserProfile;
}

const PACKAGES = [
  { label: 'Aylık', days: 30 },
  { label: '3 Aylık', days: 90 },
  { label: '6 Aylık', days: 180 },
  { label: 'Yıllık', days: 365 },
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

/**
 * Admin panelinden manuel üye kaydı VE mevcut üye düzenleme — aynı formu
 * kullanır. `data.member` verilmişse alanlar mevcut değerlerle doldurulur,
 * e-posta/şifre alanları gizlenir (hesap bilgisi burada değişmez) ve kayıt
 * `AdminMembersService.updateMember` ile, verilmemişse `createMember` ile
 * (Firebase Auth + Firestore birlikte) yapılır.
 */
@Component({
  selector: 'app-member-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './member-form-dialog.html',
  styleUrl: './member-form-dialog.scss',
})
export class MemberFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly membersService = inject(AdminMembersService);
  private readonly dialogRef = inject(MatDialogRef<MemberFormDialog>);
  private readonly data = inject<MemberFormDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  protected readonly packages = PACKAGES;
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly hidePassword = signal(true);
  protected readonly isEditMode = !!this.data.member;

  readonly form = this.fb.nonNullable.group({
    displayName: [this.data.member?.displayName ?? '', [Validators.required, Validators.minLength(2)]],
    email: [
      { value: this.data.member?.email ?? '', disabled: this.isEditMode },
      [Validators.required, Validators.email],
    ],
    phone: [
      this.data.member?.phone ?? '',
      [Validators.required, Validators.pattern(/^[0-9+()\s-]{7,20}$/)],
    ],
    password: [
      '',
      this.isEditMode ? [] : [Validators.required, Validators.minLength(6)],
    ],
    gender: [this.data.member?.gender ?? ('unspecified' as const)],
    birthDate: [toDateInputValue(this.data.member?.birthDate)],
    membershipStatus: [this.data.member?.membershipStatus ?? ('active' as const)],
    packageDays: [this.packageDaysFor(this.data.member?.packageLabel) ?? 30],
    notes: [this.data.member?.notes ?? ''],
  });

  private packageDaysFor(label: string | null | undefined): number | undefined {
    return PACKAGES.find((p) => p.label === label)?.days;
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

      if (this.isEditMode && this.data.member) {
        await this.membersService.updateMember(this.data.member.uid, {
          displayName: value.displayName.trim(),
          phone: value.phone.trim(),
          gender: value.gender,
          birthDate: value.birthDate ? new Date(value.birthDate) : null,
          membershipStatus: value.membershipStatus,
          packageDays: isActive ? value.packageDays : null,
          packageLabel: isActive ? selectedPackage?.label ?? null : null,
          notes: value.notes.trim(),
        });
      } else {
        await this.membersService.createMember({
          displayName: value.displayName.trim(),
          email: value.email.trim(),
          phone: value.phone.trim(),
          password: value.password,
          gender: value.gender,
          birthDate: value.birthDate ? new Date(value.birthDate) : null,
          membershipStatus: value.membershipStatus,
          packageDays: isActive ? value.packageDays : null,
          packageLabel: isActive ? selectedPackage?.label ?? null : null,
          notes: value.notes.trim(),
        });
      }

      this.dialogRef.close(true);
    } catch (error) {
      this.errorMessage.set(toAuthErrorMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
