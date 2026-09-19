import { Timestamp } from '@angular/fire/firestore';

export interface PtAppointment {
  id: string;
  userId: string;
  tenantId: string;
  trainerId: string;
  trainerName: string;
  appointmentTime: Timestamp;
  duration: number; // minutes
  status: 'booked' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  completedAt?: Timestamp | null;
  cancellationReason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreatePtAppointmentInput {
  trainerId: string;
  trainerName: string;
  appointmentTime: Date;
  duration: number;
  notes?: string;
}

export type UpdatePtAppointmentInput = Partial<Omit<CreatePtAppointmentInput, 'trainerId'>>;
