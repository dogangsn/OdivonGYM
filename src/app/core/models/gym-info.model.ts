import { Timestamp } from '@angular/fire/firestore';

export interface GymInfo {
  id: string; // Usually same as tenantId
  tenantId: string;
  businessName: string;
  businessType: 'individual' | 'company';
  taxId?: string;
  businessEmail: string;
  businessPhone: string;
  website?: string;
  logo?: string;
  trialDays: number; // default trial duration in days
  defaultPackageId?: string; // default package for new members
  maxFreezeDays?: number;
  cancellationPolicy?: string;
  termsAndConditions?: string;
  features: string[]; // gym features/amenities
  updatedAt: Timestamp;
  createdAt: Timestamp;
}

export interface CreateGymInfoInput {
  businessName: string;
  businessType: 'individual' | 'company';
  taxId?: string;
  businessEmail: string;
  businessPhone: string;
  website?: string;
  logo?: string;
  trialDays: number;
  defaultPackageId?: string;
  maxFreezeDays?: number;
  cancellationPolicy?: string;
  termsAndConditions?: string;
  features: string[];
}

export type UpdateGymInfoInput = Partial<Omit<CreateGymInfoInput, 'businessType'>>;
