import { Timestamp } from '@angular/fire/firestore';

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'legs' | 'arms' | 'core' | 'fullbody';

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Göğüs',
  back: 'Sırt & Kanat',
  shoulders: 'Omuz & Trapez',
  legs: 'Bacak & Kalf',
  arms: 'Kol (Biceps & Triceps)',
  core: 'Karın & Core',
  fullbody: 'Tüm Vücut / Kondisyon',
};

export interface GymFacility {
  id: string;
  tenantId: string;
  branchId?: string | null;
  name: string; // Örn: "Ağırlık & Fitness Katı", "Tatami & Boks Ringi", "Reformer Stüdyosu", "Kardiyo Bölümü"
  disciplineIds: string[]; // Bu alanda yapılan sporlar (Fitness, Kickboks vb.)
  capacity: number; // Maksimum kişi kapasitesi
  description?: string;
  status: 'active' | 'maintenance' | 'closed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GymEquipment {
  id: string;
  tenantId: string;
  facilityId?: string | null; // Bulunduğu alan / stüdyo
  disciplineId?: string | null; // Özel olarak ait olduğu branş
  name: string; // Örn: "Chest Press Makinesi", "Smith Machine", "Kum Torbası (150cm)", "Reformer Masası", "Dumbbell Seti (2.5 - 40kg)"
  brandModel?: string; // Örn: "Life Fitness Signature", "Everlast Pro"
  serialOrTag?: string; // Cihaz seri no / demirbaş kodu
  targetMuscleGroups: MuscleGroup[]; // Örn: ['chest', 'arms']
  quantity: number;
  condition: 'perfect' | 'good' | 'needs_maintenance' | 'out_of_order';
  lastMaintenanceDate?: Timestamp | null;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateGymFacilityInput {
  branchId?: string | null;
  name: string;
  disciplineIds: string[];
  capacity: number;
  description?: string;
  status?: 'active' | 'maintenance' | 'closed';
}

export type UpdateGymFacilityInput = Partial<CreateGymFacilityInput>;

export interface CreateGymEquipmentInput {
  facilityId?: string | null;
  disciplineId?: string | null;
  name: string;
  brandModel?: string;
  serialOrTag?: string;
  targetMuscleGroups: MuscleGroup[];
  quantity: number;
  condition: 'perfect' | 'good' | 'needs_maintenance' | 'out_of_order';
  lastMaintenanceDate?: Date | null;
  notes?: string;
}

export type UpdateGymEquipmentInput = Partial<CreateGymEquipmentInput>;

/** Varsayılan donanım ve alet önerileri */
export const DEFAULT_EQUIPMENT_PRESETS: CreateGymEquipmentInput[] = [
  {
    name: 'Chest Press Makinesi',
    brandModel: 'Pro Series',
    targetMuscleGroups: ['chest', 'arms'],
    quantity: 2,
    condition: 'perfect',
    notes: 'Göğüs ve arka kol için izole itiş makinesi',
  },
  {
    name: 'Lat Pulldown & Seated Row',
    brandModel: 'Dual Cable System',
    targetMuscleGroups: ['back', 'arms'],
    quantity: 2,
    condition: 'good',
    notes: 'Sırt ve kanat kasları için kablolu çekiş istasyonu',
  },
  {
    name: 'Leg Press 45 Derece',
    brandModel: 'Plate Loaded Heavy',
    targetMuscleGroups: ['legs'],
    quantity: 1,
    condition: 'perfect',
    notes: 'Ön bacak ve kalça için ağır itiş platformu',
  },
  {
    name: 'Smith Machine Barbell',
    brandModel: 'Guided Bar System',
    targetMuscleGroups: ['chest', 'shoulders', 'legs'],
    quantity: 1,
    condition: 'perfect',
    notes: 'Omuz press, squat ve bench press için kılavuzlu bar',
  },
  {
    name: 'Ağır Kum Torbası (Deri)',
    brandModel: 'Fighter Series 150cm',
    targetMuscleGroups: ['fullbody', 'core'],
    quantity: 4,
    condition: 'good',
    notes: 'Boks ve Kickboks kombinasyonları için',
  },
  {
    name: 'Kuleli Reformer Masası',
    brandModel: 'Studio Deluxe',
    targetMuscleGroups: ['core', 'legs', 'back'],
    quantity: 4,
    condition: 'perfect',
    notes: 'Reformer Pilates dersleri için yaylı ve kuleli sistem',
  },
];
