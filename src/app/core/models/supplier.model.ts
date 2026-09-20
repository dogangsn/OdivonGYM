import { Timestamp } from '@angular/fire/firestore';

export type SupplierCategory =
  | 'equipment'
  | 'supplements'
  | 'beverage'
  | 'cleaning'
  | 'tech_security'
  | 'other';

export interface Supplier {
  id: string;
  tenantId: string;
  name: string; // Firma Adı (Örn: "Technogym Türkiye", "Hardline Nutrition", "Kuzey İçecek")
  contactPerson?: string; // Yetkili Kişi
  category: SupplierCategory;
  phone: string;
  email?: string;
  taxOffice?: string; // Vergi Dairesi
  taxNumber?: string; // Vergi Kimlik No (VKN / TCKN)
  balance: number; // Cari Bakiye (Pozitif = Borcumuz var, Negatif = Alacaklıyız)
  iban?: string; // Ödeme IBAN Numarası
  address?: string;
  status: 'active' | 'passive';
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateSupplierInput {
  name: string;
  contactPerson?: string;
  category: SupplierCategory;
  phone: string;
  email?: string;
  taxOffice?: string;
  taxNumber?: string;
  balance?: number;
  iban?: string;
  address?: string;
  notes?: string;
  status?: 'active' | 'passive';
}

export type UpdateSupplierInput = Partial<CreateSupplierInput>;
