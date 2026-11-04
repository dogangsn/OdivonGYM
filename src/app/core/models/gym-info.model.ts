export interface GymInfo {
  id: string;
  tenantId: string;
  businessName: string;
  businessType: "individual" | "company";
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
  city?: string;
  address?: string;
  openTime?: string;
  closeTime?: string;
  workingDays?: number[];
  updatedAt: string;
  createdAt: string;
}

export interface CreateGymInfoInput {
  businessName: string;
  businessType: "individual" | "company";
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
  city?: string;
  address?: string;
  openTime?: string;
  closeTime?: string;
  workingDays?: number[];
}

export type UpdateGymInfoInput = Partial<Omit<CreateGymInfoInput, "businessType">>;
