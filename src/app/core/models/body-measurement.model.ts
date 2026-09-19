import { Timestamp } from '@angular/fire/firestore';

export interface BodyMeasurement {
  id: string;
  userId: string;
  tenantId: string;
  date: Timestamp;
  weight?: number; // kg
  chest?: number; // cm
  waist?: number; // cm
  hips?: number; // cm
  bicep?: number; // cm
  thigh?: number; // cm
  calf?: number; // cm
  bodyFatPercentage?: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateBodyMeasurementInput {
  date: Date;
  weight?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  bicep?: number;
  thigh?: number;
  calf?: number;
  bodyFatPercentage?: number;
  notes?: string;
}

export type UpdateBodyMeasurementInput = Partial<CreateBodyMeasurementInput>;
