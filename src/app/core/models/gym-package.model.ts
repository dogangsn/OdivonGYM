import { Timestamp } from '@angular/fire/firestore';

export interface GymPackage {
  id: string;
  tenantId: string;
  name: string;
  durationDays: number;
  price: number; // TL
  description?: string;
  features: string[]; // List of included features
  maxFreeze?: number; // days user can freeze membership
  trialEligible: boolean;
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
  durationDays: number;
  price: number;
  description?: string;
  features: string[];
  maxFreeze?: number;
  trialEligible: boolean;
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
