import { Timestamp } from '@angular/fire/firestore';

export interface Exercise {
  name: string;
  reps?: number;
  sets?: number;
  weight?: number;
  duration?: number; // seconds
  notes?: string;
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  tenantId: string;
  templateId?: string; // Reference to trainer's template
  title: string;
  description?: string;
  exercises: Exercise[];
  startDate: Timestamp;
  endDate?: Timestamp | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateWorkoutPlanInput {
  templateId?: string;
  title: string;
  description?: string;
  exercises: Exercise[];
  startDate: Date;
  endDate?: Date | null;
  notes?: string;
}

export type UpdateWorkoutPlanInput = Partial<Omit<CreateWorkoutPlanInput, 'templateId'>>;
