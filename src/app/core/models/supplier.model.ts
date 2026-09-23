import { Timestamp } from '@angular/fire/firestore';

export type SupplierCategory =
  | 'equipment'
  | 'supplements'
  | 'beverage'
  | 'cleaning'
  | 'tech_security'
  | 'other'
  | string;

export interface SupplierCategoryItem {
  id?: string;
  tenantId: string;
  key: string;
  name: string;
  colorTag?: string;
  badgeClass?: string;
  description?: string;
  createdAt?: any;
  updatedAt?: any;
}

export const DEFAULT_SUPPLIER_CATEGORIES: Omit<SupplierCategoryItem, 'id' | 'tenantId'>[] = [
  {
    key: 'equipment',
    name: 'Ekipman & Cihaz',
    colorTag: 'indigo',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
    description: 'Spor aletleri, kardiyo makineleri, serbest ağırlık ve mekanik ekipman tedarikçileri.',
  },
  {
    key: 'supplements',
    name: 'Supplement & Gıda',
    colorTag: 'emerald',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    description: 'Protein tozları, amino asitler, barlar, vitaminler ve sporcu besinleri toptancıları.',
  },
  {
    key: 'beverage',
    name: 'İçecek & Otomat',
    colorTag: 'cyan',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
    description: 'Doğal kaynak suyu, maden suyu, izotonik içecek ve otomat dolum sağlayıcıları.',
  },
  {
    key: 'cleaning',
    name: 'Temizlik & Hijyen',
    colorTag: 'amber',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    description: 'Dezenfektanlar, kağıt havlu, zemin temizleme ve salon hijyen sarf malzemeleri.',
  },
  {
    key: 'tech_security',
    name: 'Bilişim & Güvenlik',
    colorTag: 'purple',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    description: 'Turnike kartları, kamera & alarm sistemleri, ses düzeni ve yazılım donanımları.',
  },
  {
    key: 'other',
    name: 'Diğer Hizmetler',
    colorTag: 'slate',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    description: 'Matbaa, bina bakım-onarım, tekstil ve genel işletme hizmetleri.',
  },
];

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
