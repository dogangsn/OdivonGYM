export type PackageScope = 'gym' | 'trainer';

export interface TrainerPackagePricing {
  trainerId: string;
  trainerName: string;
  price: number;
  sessionCount?: number | null;
  commissionRate?: number | null;
}

export interface GymPackage {
  id: string;
  tenantId?: string;
  name: string;
  category?: string;
  durationDays: number;
  durationType?: 'day' | 'month' | 'year';
  durationValue?: number;
  price: number;
  description?: string;
  features: string[];
  maxFreeze?: number;
  trialEligible: boolean;
  allowedDays?: number[];
  checkInStartTime?: string;
  checkInEndTime?: string;
  sessionCount?: number | null;
  isUnlimitedSessions?: boolean;
  /** Grup dersi hakkı (üyelik dönemi başına); boş = sınırsız. */
  classCredits?: number | null;
  barcode?: string;
  isHidden?: boolean;
  requiredDocuments?: string[]; // Bu paket için zorunlu evrak tanımları (['health_report', 'parent_consent'])
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;

  /** Paket Kapsamı: Salon Geneli ('gym') veya Personele / Antrenöre Özel ('trainer') */
  packageScope?: PackageScope;
  /** Personele özel ise antrenör / personel ID */
  trainerId?: string | null;
  /** Personele özel ise antrenör / personel adı */
  trainerName?: string | null;
  /** Personele ödenecek prim / komisyon yüzdesi (%) */
  trainerCommissionRate?: number | null;
  /** Çoklu eğitmen / antrenör fiyat matrisi */
  trainerPricing?: TrainerPackagePricing[];
}

export interface UserPackagePurchase {
  id: string;
  userId: string;
  tenantId: string;
  packageId: string;
  packageName: string;
  purchaseDate: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  renewalDate?: string | null;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'wallet';
  price: number;
  status: 'active' | 'expired' | 'cancelled' | 'on-hold';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGymPackageInput {
  name: string;
  category?: string;
  durationDays: number;
  durationType?: 'day' | 'month' | 'year';
  durationValue?: number;
  price: number;
  description?: string;
  features: string[];
  maxFreeze?: number;
  trialEligible: boolean;
  allowedDays?: number[];
  checkInStartTime?: string;
  checkInEndTime?: string;
  sessionCount?: number | null;
  isUnlimitedSessions?: boolean;
  /** Grup dersi hakkı (üyelik dönemi başına); boş = sınırsız. */
  classCredits?: number | null;
  barcode?: string;
  isHidden?: boolean;
  requiredDocuments?: string[];

  packageScope?: PackageScope;
  trainerId?: string | null;
  trainerName?: string | null;
  trainerCommissionRate?: number | null;
  trainerPricing?: TrainerPackagePricing[];
}

export type UpdateGymPackageInput = Partial<CreateGymPackageInput> & { status?: GymPackage['status'] };

export interface CreateUserPackagePurchaseInput {
  packageId: string;
  packageName: string;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'wallet';
  price: number;
  notes?: string;
}
