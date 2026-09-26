export interface GymInfo {
  id: string;
  tenantId: string;
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
  updatedAt: string;
  createdAt: string;
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
