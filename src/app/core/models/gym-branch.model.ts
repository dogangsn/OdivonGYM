export interface OpeningHours {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  open: string;
  close: string;
  closed: boolean;
}

export const DAYS_OF_WEEK = [
  { id: 1, label: 'Pazartesi', short: 'Pzt' },
  { id: 2, label: 'Salı', short: 'Sal' },
  { id: 3, label: 'Çarşamba', short: 'Çar' },
  { id: 4, label: 'Perşembe', short: 'Per' },
  { id: 5, label: 'Cuma', short: 'Cum' },
  { id: 6, label: 'Cumartesi', short: 'Cmt' },
  { id: 0, label: 'Pazar', short: 'Paz' },
] as const;

export interface GymBranch {
  id: string;
  tenantId?: string;
  name: string;
  logoUrl?: string;
  address: string;
  city: string;
  postalCode?: string;
  phone: string;
  email: string;
  website?: string;
  capacity: number;
  currentOccupancy: number;
  openingHours: OpeningHours[];
  openDays?: number[];
  features: string[];
  status: 'active' | 'closed' | 'maintenance';
  managerName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGymBranchInput {
  name: string;
  logoUrl?: string;
  address: string;
  city: string;
  postalCode?: string;
  phone: string;
  email: string;
  website?: string;
  capacity: number;
  openingHours: OpeningHours[];
  openDays?: number[];
  features: string[];
  managerName?: string;
}

export type UpdateGymBranchInput = Partial<CreateGymBranchInput> & { status?: GymBranch['status'] };
