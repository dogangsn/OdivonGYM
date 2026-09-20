import { Timestamp } from '@angular/fire/firestore';

export interface OpeningHours {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
  open: string; // HH:mm
  close: string; // HH:mm
  closed: boolean;
}

export interface GymBranch {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  city: string;
  postalCode?: string;
  phone: string;
  email: string;
  website?: string;
  capacity: number; // max concurrent users
  currentOccupancy: number;
  openingHours: OpeningHours[]; // array of 7 items for each day
  features: string[];
  status: 'active' | 'closed' | 'maintenance';
  managerName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateGymBranchInput {
  name: string;
  address: string;
  city: string;
  postalCode?: string;
  phone: string;
  email: string;
  website?: string;
  capacity: number;
  openingHours: OpeningHours[];
  features: string[];
  managerName?: string;
}

export type UpdateGymBranchInput = Partial<CreateGymBranchInput> & { status?: GymBranch['status'] };
