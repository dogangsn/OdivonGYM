import { Timestamp } from '@angular/fire/firestore';

export interface ClassSchedule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  instructorId: string;
  instructorName: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 6 = Saturday
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  capacity: number;
  currentBookings: number;
  level?: 'beginner' | 'intermediate' | 'advanced';
  status: 'active' | 'cancelled' | 'paused';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ClassBooking {
  id: string;
  userId: string;
  tenantId: string;
  classScheduleId: string;
  className: string;
  bookingDate: Timestamp;
  attendanceStatus: 'booked' | 'checked-in' | 'no-show' | 'cancelled';
  checkedInAt?: Timestamp | null;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateClassScheduleInput {
  name: string;
  description?: string;
  instructorId: string;
  instructorName: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string;
  endTime: string;
  capacity: number;
  level?: 'beginner' | 'intermediate' | 'advanced';
}

export type UpdateClassScheduleInput = Partial<Omit<CreateClassScheduleInput, 'instructorId'>>;

export interface CreateClassBookingInput {
  classScheduleId: string;
  className: string;
  notes?: string;
}
