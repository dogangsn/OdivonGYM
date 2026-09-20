import { Timestamp } from '@angular/fire/firestore';

export type DisciplineCode =
  | 'fitness'
  | 'kickboxing'
  | 'boxing'
  | 'pilates'
  | 'swimming'
  | 'crossfit'
  | 'yoga'
  | 'other';

export type DisciplineCategory = 'combat' | 'strength' | 'cardio' | 'flexibility' | 'aquatic';

export type SessionFormat = 'free' | 'group' | 'pt';

export interface SportsDiscipline {
  id: string;
  tenantId: string;
  name: string; // Örn: "Kickboks", "Fitness", "Klasik Boks", "Reformer Pilates"
  code: DisciplineCode;
  category: DisciplineCategory;
  description?: string;
  icon: string; // Material icon adı
  colorTag: string; // Tailwind renk sınıfı örn: 'indigo', 'rose', 'amber', 'emerald', 'cyan'
  requiredDocuments: string[]; // ['health_report', 'parent_consent', 'federation_license']
  supportedSessionTypes: SessionFormat[];
  status: 'active' | 'inactive';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateSportsDisciplineInput {
  name: string;
  code: DisciplineCode;
  category: DisciplineCategory;
  description?: string;
  icon: string;
  colorTag: string;
  requiredDocuments: string[];
  supportedSessionTypes: SessionFormat[];
  status?: 'active' | 'inactive';
}

export type UpdateSportsDisciplineInput = Partial<CreateSportsDisciplineInput>;

/** Sistem varsayılan hazır branş şablonları */
export const DEFAULT_DISCIPLINES_PRESETS: CreateSportsDisciplineInput[] = [
  {
    name: 'Fitness & Vücut Geliştirme',
    code: 'fitness',
    category: 'strength',
    description: 'Serbest ağırlık, izole makineler, kardiyo ve bölgesel kas geliştirme.',
    icon: 'fitness_center',
    colorTag: 'indigo',
    requiredDocuments: ['health_report'],
    supportedSessionTypes: ['free', 'pt'],
    status: 'active',
  },
  {
    name: 'Kickboks',
    code: 'kickboxing',
    category: 'combat',
    description: 'Yüksek yoğunluklu dövüş, torba çalışması, teknik kombinasyonlar ve kondisyon.',
    icon: 'sports_martial_arts',
    colorTag: 'rose',
    requiredDocuments: ['health_report', 'parent_consent', 'federation_license'],
    supportedSessionTypes: ['group', 'pt'],
    status: 'active',
  },
  {
    name: 'Klasik Boks',
    code: 'boxing',
    category: 'combat',
    description: 'Ring içi ayak oyunları, kum torbası, lapa çalışması ve savunma teknikleri.',
    icon: 'sports_kabaddi',
    colorTag: 'amber',
    requiredDocuments: ['health_report', 'parent_consent', 'federation_license'],
    supportedSessionTypes: ['group', 'pt'],
    status: 'active',
  },
  {
    name: 'Reformer Pilates',
    code: 'pilates',
    category: 'flexibility',
    description: 'Kuleli reformer makinelerinde duruş bozukluğu düzeltme, core güçlendirme ve esneklik.',
    icon: 'self_improvement',
    colorTag: 'emerald',
    requiredDocuments: ['health_report'],
    supportedSessionTypes: ['group', 'pt'],
    status: 'active',
  },
  {
    name: 'Yüzme',
    code: 'swimming',
    category: 'aquatic',
    description: 'Serbest yüzme, stil geliştirme ve kardiyovasküler su antrenmanları.',
    icon: 'pool',
    colorTag: 'cyan',
    requiredDocuments: ['health_report'],
    supportedSessionTypes: ['free', 'group', 'pt'],
    status: 'active',
  },
];
