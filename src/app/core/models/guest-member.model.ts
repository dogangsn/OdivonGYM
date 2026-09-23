import { Timestamp } from '@angular/fire/firestore';

export interface GuestMember {
  id: string;
  tenantId: string;
  fullName: string;
  phone: string;
  email?: string;
  gender?: 'female' | 'male' | 'unspecified';
  interestCategory: string; // Örn: 'Fitness & Gym', 'Reformer Pilates', 'Kilo Verme', 'Özel Ders (PT)'
  visitReason: string; // Örn: 'Salonu Gezme / Bilgi Alma', 'Fiyat Teklifi', 'Deneme Antrenmanı'
  surveyNotes?: string; // Anket ve ilgi notları
  budgetRange?: string; // Bütçe beklentisi
  status: 'visited' | 'called' | 'converted' | 'lost';
  followUpDate?: Timestamp | null;
  assignedStaffName?: string;
  branchId?: string | null;
  branchName?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateGuestMemberInput {
  fullName: string;
  phone: string;
  email?: string;
  gender?: 'female' | 'male' | 'unspecified';
  interestCategory: string;
  visitReason: string;
  surveyNotes?: string;
  budgetRange?: string;
  status: 'visited' | 'called' | 'converted' | 'lost';
  followUpDate?: Date | null;
  assignedStaffName?: string;
  branchId?: string | null;
  branchName?: string | null;
}

export type UpdateGuestMemberInput = Partial<CreateGuestMemberInput>;
