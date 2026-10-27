import { formatDateTime } from '../../shared/ui/ui-utils';

export type AuditChanges = Record<string, { from: unknown; to: unknown }> | null | undefined;

/** İşlem kaydındaki alan adlarının ekranda görünen karşılıkları. */
export const AUDIT_FIELD_LABELS: Record<string, string> = {
  displayName: 'Ad soyad',
  email: 'E-posta',
  phone: 'Telefon',
  nationalId: 'T.C. kimlik no',
  gender: 'Cinsiyet',
  birthDate: 'Doğum tarihi',
  address: 'Adres',
  emergencyContact: 'Acil durum kişisi',
  emergencyPhone: 'Acil durum telefonu',
  membershipStatus: 'Üyelik durumu',
  membershipStartsAt: 'Üyelik başlangıcı',
  membershipEndsAt: 'Üyelik bitişi',
  packageLabel: 'Paket',
  packageId: 'Paket',
  packagePrice: 'Paket fiyatı',
  walletBalance: 'Cüzdan bakiyesi',
  classCreditsTotal: 'Ders hakkı',
  classCreditsUsed: 'Kullanılan ders',
  memberNumber: 'Üye no',
  trainerId: 'Antrenör',
  trainerName: 'Antrenör',
  branchId: 'Şube',
  branchName: 'Şube',
  branchIds: 'Şubeler',
  branchNames: 'Şubeler',
  notes: 'Not',
  price: 'Fiyat',
  durationDays: 'Süre (gün)',
  status: 'Durum',
  stock: 'Stok',
  amount: 'Tutar',
  totalAmount: 'Toplam tutar',
  paidAmount: 'Ödenen',
  remainingAmount: 'Kalan borç',
  installments: 'Taksitler',
  payments: 'Ödemeler',
  role: 'Rol',
  title: 'Unvan',
  monthlySalary: 'Maaş',
  commissionRate: 'Prim oranı',
  isArchived: 'Arşivde',
  archivedAt: 'Arşivlenme',
  deletedAt: 'Silinme',
  rfidCardNumber: 'Kart no',
  photoURL: 'Fotoğraf',
  referredByMemberId: 'Tavsiye eden',
  referredByName: 'Tavsiye eden',
  leadSource: 'Aday kaynağı',
  kvkkConsent: 'KVKK onayı',
};

const STATUS_VALUES: Record<string, string> = {
  active: 'Aktif',
  trial: 'Deneme',
  expired: 'Süresi bitti',
  cancelled: 'İptal',
  open: 'Açık',
  paid: 'Ödendi',
};

/** Kayıttaki bir değeri okunur metne çevirir (tarih, evet/hayır, durum…). */
export function auditDisplay(value: unknown, field = ''): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  if (typeof value === 'string' && (field === 'membershipStatus' || field === 'status')) return STATUS_VALUES[value] ?? value;
  if (Array.isArray(value)) return `${value.length} kayıt`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export interface AuditChangeRow {
  field: string;
  label: string;
  from: string;
  to: string;
}

export function auditChangeRows(changes: AuditChanges): AuditChangeRow[] {
  return Object.entries(changes ?? {}).map(([field, change]) => ({
    field,
    label: AUDIT_FIELD_LABELS[field] ?? field,
    from: auditDisplay(change.from, field),
    to: auditDisplay(change.to, field),
  }));
}
