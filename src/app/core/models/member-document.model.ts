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

export interface DocumentDefinition {
  id: string; // e.g. 'health_report', 'parent_consent', or custom ID
  code: string;
  name: string;
  description?: string;
  documentType: DocumentType;
  requiresExpiry?: boolean;
  isRequiredByDefault?: boolean;
  isSystemDefault?: boolean;
  isActive: boolean;
  createdAt?: string;
}

export const DEFAULT_DOCUMENT_DEFINITIONS: DocumentDefinition[] = [
  {
    id: 'health_report',
    code: 'health_report',
    name: 'Sağlık Raporu (Spor Yapabilir)',
    description: 'Spor faaliyetlerine katılım için hekim onaylı sağlık raporu.',
    documentType: 'health_report',
    requiresExpiry: true,
    isRequiredByDefault: true,
    isSystemDefault: true,
    isActive: true,
  },
  {
    id: 'parent_consent',
    code: 'parent_consent',
    name: '18 Yaş Altı Veli Muvafakatnamesi',
    description: 'Reşit olmayan bireyler için veli/vasi onay belgesi.',
    documentType: 'parent_consent',
    requiresExpiry: false,
    isSystemDefault: true,
    isActive: true,
  },
  {
    id: 'federation_license',
    code: 'federation_license',
    name: 'Federasyon Sporcu Lisansı',
    description: 'Müsabaka ve branş tescilli resmi sporcu lisansı.',
    documentType: 'federation_license',
    requiresExpiry: true,
    isSystemDefault: true,
    isActive: true,
  },
  {
    id: 'waiver_form',
    code: 'waiver_form',
    name: 'Feragatname / Risk Kabul Formu',
    description: 'Dövüş, ağırlık ve su sporları sorumluluk beyanı.',
    documentType: 'waiver_form',
    requiresExpiry: false,
    isSystemDefault: true,
    isActive: true,
  },
  {
    id: 'membership_agreement',
    code: 'membership_agreement',
    name: 'Dijital Üyelik & KVKK Sözleşmesi',
    description: 'Islak / e-imzalı üyelik ve aydınlatma taahhütnamesi.',
    documentType: 'membership_agreement',
    requiresExpiry: false,
    isSystemDefault: true,
    isActive: true,
  },
];

export interface MemberDocument {
  id: string;
  userId: string;
  tenantId: string;
  disciplineId?: string | null; // Belgenin geçerli olduğu branş (örn: Kickboks lisansı)
  documentType: DocumentType;
  documentName: string; // Örn: "2026 Kickboks Lisans Belgesi"
  fileUrl?: string | null; // Belge görseli / PDF URL / Data URL
  fileName?: string | null; // Dosya adı (örn: saglik_raporu.pdf)
  fileType?: string | null; // MIME tipi (örn: application/pdf, image/jpeg)
  fileSize?: number | null; // Bayt cinsinden boyut
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
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  issueDate: Date;
  expiryDate?: Date | null;
  status: DocumentStatus;
  notes?: string;
}

export type UpdateMemberDocumentInput = Partial<Omit<CreateMemberDocumentInput, 'userId'>>;
