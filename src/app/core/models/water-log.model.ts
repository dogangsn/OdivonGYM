import { Timestamp } from '@angular/fire/firestore';

export interface WaterLog {
  id: string;
  userId: string;
  tenantId: string;
  date: Timestamp; // Date only (00:00:00)
  amount: number; // milliliters
  unit: 'ml' | 'liter' | 'cup' | 'bottle';
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateWaterLogInput {
  date: Date;
  amount: number;
  unit: 'ml' | 'liter' | 'cup' | 'bottle';
  notes?: string;
}

export type UpdateWaterLogInput = Partial<CreateWaterLogInput>;
