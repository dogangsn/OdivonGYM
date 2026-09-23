import { Timestamp } from '@angular/fire/firestore';

export interface GymPackage {
  id: string;
  tenantId: string;
  name: string;
  category?: string;
  durationDays: number;
  durationType?: 'day' | 'month' | 'year';
  durationValue?: number;
  price: number; // TL
  description?: string;
  features: string[]; // List of included features
  maxFreeze?: number; // days user can freeze membership
  trialEligible: boolean;
  allowedDays?: number[]; // [1,2,3,4,5,6,7] (1=Pazartesi)
  checkInStartTime?: string; // Örn '07:00'
  checkInEndTime?: string; // Örn '22:00'
  sessionCount?: number | null; // Toplam seans sayısı
  isUnlimitedSessions?: boolean;
  barcode?: string;
  isHidden?: boolean; // Web/mobil satışta gizli paket
  status: 'active' | 'inactive' | 'archived';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserPackagePurchase {
  id: string;
  userId: string;
  tenantId: string;
  packageId: string;
  packageName: string;
  purchaseDate: Timestamp;
  startDate: Timestamp;
  endDate: Timestamp;
  autoRenew: boolean;
  renewalDate?: Timestamp | null;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'wallet';
  price: number; // what was paid
  status: 'active' | 'expired' | 'cancelled' | 'on-hold';
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
