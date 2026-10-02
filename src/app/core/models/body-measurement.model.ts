import { Timestamp } from '@angular/fire/firestore';

export interface BodyMeasurement {
  id: string;
  userId: string;
  tenantId: string;
  date: Timestamp;
  weight?: number; // kg
  height?: number; // cm
  chest?: number; // cm
  waist?: number; // cm
  hips?: number; // cm
  bicep?: number; // cm
  rightBicep?: number; // cm (Sağ Kol / Pazı)
  leftBicep?: number; // cm (Sol Kol / Pazı)
  thigh?: number; // cm
  rightThigh?: number; // cm (Sağ Bacak / Uyluk)
  leftThigh?: number; // cm (Sol Bacak / Uyluk)
  calf?: number; // cm
  rightCalf?: number; // cm
  leftCalf?: number; // cm
  bodyFatPercentage?: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateBodyMeasurementInput {
  date: Date;
  weight?: number;
  height?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  bicep?: number;
  rightBicep?: number;
  leftBicep?: number;
  thigh?: number;
  rightThigh?: number;
  leftThigh?: number;
  calf?: number;
  rightCalf?: number;
  leftCalf?: number;
  bodyFatPercentage?: number;
  notes?: string;
}

export type UpdateBodyMeasurementInput = Partial<CreateBodyMeasurementInput>;
