/**
 * OdivonGYM Rol ve Yetki Altyapısı (RBAC)
 * 
 * - 'owner'        : Salon Sahibi / Patron (Tüm yetkiler: Şirket, Kasa, E-Fatura, Personel, Şubeler)
 * - 'admin'        : Genel Yönetici / Kulüp Müdürü (Tüm operasyonel ve finansal yönetim)
 * - 'trainer'      : Antrenör / PT (Eğitim sihirbazı, sporcu planlama, ölçümler, ders & randevular)
 * - 'receptionist' : Müşteri Hizmetleri / Resepsiyon (Üye kaydı, turnike geçiş, vitamin bar/kasa, randevular)
 * - 'user'         : Sporcu / Üye (Mobil sporcu paneli, antrenman takip, QR kart, cüzdan)
 */
export type UserRole = 'owner' | 'admin' | 'trainer' | 'receptionist' | 'user';

export type Permission =
  // Üye Yönetimi
  | 'members:read'
  | 'members:create'
  | 'members:update'
  | 'members:delete'
  // Antrenman & Ölçüm & Eğitim Sihirbazı
  | 'workouts:manage'
  | 'measurements:manage'
  | 'wizard:access'
  // Turnike & Geçiş Kontrol
  | 'access_control:manage'
  // Ders & PT Randevu
  | 'classes:manage'
  | 'appointments:manage'
  // Kasa, Satış, Kampanya & Muhasebe
  | 'accounting:read'
  | 'accounting:write'
  | 'shop:operate'
  | 'packages:manage'
  | 'campaigns:manage'
  | 'suppliers:manage'
  | 'e_invoice:manage'
  // Sistem, Personel & Şube
  | 'staff:manage'
  | 'branches:manage'
  | 'gym_info:manage'
  | 'settings:manage';

export interface RoleDefinition {
  id: UserRole;
  name: string;
  badge: string;
  badgeClass: string;
  icon: string;
  description: string;
  level: number;
  permissions: Permission[];
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  owner: {
    id: 'owner',
    name: 'Patron / Salon Sahibi',
    badge: 'Patron',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: 'workspace_premium',
    description: 'Tüm salon yönetimi, kasa, personel atamaları, şubeler ve resmi muhasebe entegrasyonu tam yetkisi.',
    level: 5,
    permissions: [
      'members:read',
      'members:create',
      'members:update',
      'members:delete',
      'workouts:manage',
      'measurements:manage',
      'wizard:access',
      'access_control:manage',
      'classes:manage',
      'appointments:manage',
      'accounting:read',
      'accounting:write',
      'shop:operate',
      'packages:manage',
      'campaigns:manage',
      'suppliers:manage',
      'e_invoice:manage',
      'staff:manage',
      'branches:manage',
      'gym_info:manage',
      'settings:manage',
    ],
  },
  admin: {
    id: 'admin',
    name: 'Genel Yönetici / Müdür',
    badge: 'Yönetici',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    icon: 'manage_accounts',
    description: 'Günlük operasyonlar, personel takibi, paket ve fiyatlandırma, üye ve turnike yönetimi tam yetkisi.',
    level: 4,
    permissions: [
      'members:read',
      'members:create',
      'members:update',
      'members:delete',
      'workouts:manage',
      'measurements:manage',
      'wizard:access',
      'access_control:manage',
      'classes:manage',
      'appointments:manage',
      'accounting:read',
      'accounting:write',
      'shop:operate',
      'packages:manage',
      'campaigns:manage',
      'suppliers:manage',
      'e_invoice:manage',
      'staff:manage',
      'branches:manage',
      'gym_info:manage',
      'settings:manage',
    ],
  },
  trainer: {
    id: 'trainer',
    name: 'Antrenör / PT',
    badge: 'Antrenör',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: 'fitness_center',
    description: 'Eğitim sihirbazı, sporculara özel antrenman programı yazma, vücut analizleri, grup dersleri ve randevu takibi.',
    level: 3,
    permissions: [
      'members:read',
      'workouts:manage',
      'measurements:manage',
      'wizard:access',
      'classes:manage',
      'appointments:manage',
    ],
  },
  receptionist: {
    id: 'receptionist',
    name: 'Müşteri Hizmetleri / Resepsiyon',
    badge: 'Resepsiyon',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: 'support_agent',
    description: 'Yeni üye kaydı, turnike geçiş yetkilendirme, vitamin bar ve market satışı, kasa tahsilatı ve randevu oluşturma.',
    level: 2,
    permissions: [
      'members:read',
      'members:create',
      'members:update',
      'access_control:manage',
      'shop:operate',
      'classes:manage',
      'appointments:manage',
      'packages:manage',
      'campaigns:manage',
    ],
  },
  user: {
    id: 'user',
    name: 'Sporcu / Üye',
    badge: 'Sporcu',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
    icon: 'person',
    description: 'Kişisel sporcu paneli, antrenman programı takibi, ölçüm geçmişi, turnike dijital QR kartı ve cüzdan.',
    level: 1,
    permissions: [],
  },
};
