import { UserRole } from './user-role.model';
export type { UserRole };

export type MembershipStatus = 'trial' | 'active' | 'expired' | 'cancelled';

export type Gender = 'female' | 'male' | 'unspecified';

export interface UserProfile {
  uid: string;
  tenantId: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  membershipStatus: MembershipStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  createdAt: string;
  updatedAt: string;
  phone?: string;
  nationalId?: string;
  gender?: Gender;
  birthDate?: string | null;
  membershipStartsAt?: string | null;
  membershipEndsAt?: string | null;
  packageLabel?: string | null;
  /** Paketin satış bedeli (liste fiyatı); ödenmeyen kısım taksit planında izlenir. */
  packagePrice?: number | null;
  notes?: string;
  country?: string;
  language?: string;
  walletBalance?: number;
  branchId?: string | null;
  branchName?: string | null;
  memberNumber?: string;
  trainerId?: string | null;
  trainerName?: string | null;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  bloodGroup?: string;
  allergies?: string;
  chronicDiseases?: string;
  specialInfo?: string;
  rfidCardNumber?: string;
  cardDepositFee?: number;
  cardDepositPaid?: boolean;
  isArchived?: boolean;
  archivedAt?: string | null;
  onboardingCompleted?: boolean;
  kvkkConsent?: boolean | null;
  kvkkConsentAt?: string | null;
  commercialConsent?: boolean | null;
  commercialConsentAt?: string | null;
  healthConsent?: boolean | null;
  healthConsentAt?: string | null;
}
