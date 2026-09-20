import { UserRole, Permission } from './user-role.model';

export type StaffStatus = 'active' | 'inactive' | 'leave';

export interface StaffMember {
  id: string;
  tenantId: string;
  uid?: string; // Firebase Auth hesabı varsa UID
  displayName: string;
  email: string;
  phone?: string;
  role: UserRole;
  title: string; // Örn: 'Salon Sahibi', 'Kulüp Müdürü', 'Baş Antrenör (PT)', 'Müşteri İlişkileri & Kasa'
  branchId?: string | null;
  branchName?: string | null;
  specialties?: string[]; // Örn: ['Fitness', 'Kickbox', 'Reformer Pilates', 'Fonksiyonel']
  customPermissions?: Permission[];
  status: StaffStatus;
  hireDate?: string;
  emergencyContact?: string;
  monthlySalary?: number;
  commissionRate?: number; // %
  notes?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StaffFilter {
  searchTerm: string;
  role: UserRole | 'all';
  branchId: string | 'all';
  status: StaffStatus | 'all';
}
