import { Timestamp } from '@angular/fire/firestore';

export interface PtAppointment {
  id: string;
  userId: string;
  memberName?: string;
  memberPhone?: string;
  tenantId: string;
  trainerId: string;
  trainerName: string;
  appointmentTime: Timestamp;
  duration: number; // minutes
  status: 'booked' | 'completed' | 'cancelled' | 'no-show';
  sessionType?: string;
  notes?: string;
  completedAt?: Timestamp | null;
  cancellationReason?: string;
  extras?: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreatePtAppointmentInput {
  trainerId: string;
  trainerName: string;
  appointmentTime: Date;
  duration: number;
  notes?: string;
  userId?: string;
  memberName?: string;
  memberPhone?: string;
  sessionType?: string;
}

export type UpdatePtAppointmentInput = Partial<CreatePtAppointmentInput>;
