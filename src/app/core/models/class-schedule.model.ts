import { Timestamp } from '@angular/fire/firestore';

export interface ClassSchedule {
  id: string;
  tenantId: string;
  name: string;
  disciplineId?: string | null; // İlgili branş (Kickboks, Boks, Pilates vb.)
  facilityId?: string | null; // Yapıldığı alan (Tatami, Havuz, Reformer Stüdyosu vb.)
  description?: string;
  instructorId?: string;
  instructorName: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Pazar, 1 = Pazartesi ... 6 = Cumartesi
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  capacity: number;
  currentBookings: number;
  enrolledMemberIds?: string[]; // Bu seansa doğrudan atanan sabit üyeler
  requiredDocuments?: string[]; // Bu seans için zorunlu evraklar (['health_report', 'federation_license'])
  level?: 'all' | 'beginner' | 'intermediate' | 'advanced';
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
  disciplineId?: string | null;
  facilityId?: string | null;
  description?: string;
  instructorId?: string;
  instructorName: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string;
  endTime: string;
  capacity: number;
  enrolledMemberIds?: string[];
  requiredDocuments?: string[];
  level?: 'all' | 'beginner' | 'intermediate' | 'advanced';
}

export type UpdateClassScheduleInput = Partial<CreateClassScheduleInput> & { status?: ClassSchedule['status'] };

export interface CreateClassBookingInput {
  classScheduleId: string;
  className: string;
  notes?: string;
}
