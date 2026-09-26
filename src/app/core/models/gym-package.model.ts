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
  barcode?: string;
  isHidden?: boolean;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
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
  barcode?: string;
  isHidden?: boolean;
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
