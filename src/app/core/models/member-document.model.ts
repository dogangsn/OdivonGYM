import { Timestamp } from '@angular/fire/firestore';

export type DocumentType =
  | 'membership_agreement'
  | 'health_report'
  | 'parent_consent'
  | 'federation_license'
  | 'waiver_form'
  | 'other';

export type DocumentStatus = 'approved' | 'pending_review' | 'expired' | 'rejected';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  membership_agreement: 'Dijital Üyelik & KVKK Sözleşmesi (İmzalı)',
  health_report: 'Sağlık Raporu (Spor Yapabilir)',
  parent_consent: '18 Yaş Altı Veli Muvafakatnamesi',
  federation_license: 'Federasyon Sporcu Lisansı',
  waiver_form: 'Feragatname / Risk Kabul Formu',
  other: 'Diğer Belge',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  approved: 'Onaylandı',
  pending_review: 'İnceleniyor',
  expired: 'Süresi Doldu',
  rejected: 'Reddedildi',
};

export interface MemberDocument {
  id: string;
  userId: string;
  tenantId: string;
  disciplineId?: string | null; // Belgenin geçerli olduğu branş (örn: Kickboks lisansı)
  documentType: DocumentType;
  documentName: string; // Örn: "2026 Kickboks Lisans Belgesi"
  fileUrl?: string | null; // Belge görseli / PDF URL
  issueDate: Timestamp;
  expiryDate?: Timestamp | null;
  status: DocumentStatus;
  verifiedBy?: string | null; // Onaylayan admin/yönetici adı
  verifiedAt?: Timestamp | null;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateMemberDocumentInput {
  userId: string;
  disciplineId?: string | null;
  documentType: DocumentType;
  documentName: string;
  fileUrl?: string | null;
  issueDate: Date;
  expiryDate?: Date | null;
  status: DocumentStatus;
  notes?: string;
}

export type UpdateMemberDocumentInput = Partial<Omit<CreateMemberDocumentInput, 'userId'>>;
