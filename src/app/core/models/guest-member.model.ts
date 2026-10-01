export type LeadStage = 'visited' | 'called' | 'trial' | 'converted' | 'lost';

export type LeadSource = 'walk_in' | 'instagram' | 'google' | 'website' | 'phone' | 'referral' | 'campaign' | 'other';

export interface StageEvent {
  stage: LeadStage;
  at: string;
  by: string;
}

/** Potansiyel üye (aday). Tarihler API'den ISO metin olarak gelir. */
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
  status: LeadStage;
  source?: LeadSource | null;
  referrerMemberId?: string | null;
  referrerName?: string | null;
  lostReason?: string | null;
  stageHistory?: StageEvent[];
  convertedMemberId?: string | null;
  convertedAt?: string | null;
  followUpDate?: string | null;
  assignedStaffName?: string;
  branchId?: string | null;
  branchName?: string | null;
  createdAt: string;
  updatedAt: string;
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
  status: LeadStage;
  source?: LeadSource | null;
  referrerMemberId?: string | null;
  referrerName?: string | null;
  lostReason?: string | null;
  followUpDate?: Date | null;
  assignedStaffName?: string;
  branchId?: string | null;
  branchName?: string | null;
}

export type UpdateGuestMemberInput = Partial<CreateGuestMemberInput>;
