export type ConsentType =
  | 'kvkk_general'
  | 'commercial_communication'
  | 'health_biometric'
  | 'camera_cctv'
  | 'cookie_policy';

export const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  kvkk_general: 'KVKK Genel Aydınlatma ve Açık Rıza',
  commercial_communication: 'Ticari İleti Onayı (SMS / E-posta)',
  health_biometric: 'Özel Nitelikli Sağlık Verisi Rızası',
  camera_cctv: 'Güvenlik Kameraları Aydınlatma Metni',
  cookie_policy: 'Çerez Politikası ve Aydınlatma Metni',
};

export type ConsentChannel =
  | 'ADMIN_PANEL'
  | 'MEMBER_PORTAL'
  | 'MOBILE_APP'
  | 'KIOSK'
  | 'SMS_OTP';

export const CONSENT_CHANNEL_LABELS: Record<ConsentChannel, string> = {
  ADMIN_PANEL: 'Yönetim Paneli (Personel)',
  MEMBER_PORTAL: 'Üye Portalı (Web)',
  MOBILE_APP: 'Mobil Uygulama',
  KIOSK: 'Salon Kiosk Ekranı',
  SMS_OTP: 'SMS Doğrulama Kodu',
};

export type ConsentStatus = 'granted' | 'revoked' | 'none';

export interface ConsentText {
  type: ConsentType;
  title: string;
  version: string;
  isRequired: boolean;
  isActive: boolean;
  contentHtml: string;
}

export interface ConsentLog {
  id: string;
  tenantId: string;
  memberId: string;
  memberFullName: string;
  consentType: ConsentType;
  version: string;
  status: 'granted' | 'revoked';
  channel: ConsentChannel;
  ipAddress?: string | null;
  userAgent?: string | null;
  authorizedByStaffId: string;
  consentedAt: string;
  notes?: string | null;
}

export interface MemberConsentSummary {
  status: ConsentStatus;
  version?: string;
  consentedAt?: string;
}

export interface MemberConsentResponse {
  memberId: string;
  displayName: string;
  summary: Record<ConsentType, MemberConsentSummary>;
  history: ConsentLog[];
}

export interface RecordConsentItemInput {
  consentType: ConsentType;
  version?: string;
  granted: boolean;
  notes?: string;
}

export interface RecordMemberConsentsInput {
  memberId: string;
  memberFullName: string;
  channel?: ConsentChannel;
  consents: RecordConsentItemInput[];
  ipAddress?: string;
  userAgent?: string;
}

export interface RevokeConsentInput {
  memberId: string;
  consentType: ConsentType;
  reason?: string;
  channel?: ConsentChannel;
}
