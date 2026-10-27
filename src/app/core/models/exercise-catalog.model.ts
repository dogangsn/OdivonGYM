import { MuscleGroup } from './gym-equipment.model';

/** OdivonMainApi `src/modules/gym/exercises` (system-exercises.ts / exercise.dto.ts) ile aynı. */
export type ExerciseEquipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'smith'
  | 'ezbar'
  | 'cardio'
  | 'other';

export type ExerciseTrackingType = 'weight_reps' | 'reps' | 'duration' | 'distance';

export interface CatalogExercise {
  id: string;
  /** system: `sys-ex-*` (salt okunur), gym: salonun egzersizi, member: üyenin kendi (panelde görünmez). */
  source: 'system' | 'gym' | 'member';
  name: string;
  nameEn: string;
  muscleGroup: MuscleGroup;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: ExerciseEquipment;
  equipmentName: string;
  mechanic: 'compound' | 'isolation';
  trackingType: ExerciseTrackingType;
  defaultSets: number;
  defaultReps: number | string;
  defaultRestSeconds: number;
  instructions: string[];
  imageUrl: string | null;
}

export interface ExerciseInput {
  name: string;
  nameEn?: string;
  muscleGroup: MuscleGroup;
  primaryMuscle?: string;
  equipment: ExerciseEquipment;
  equipmentName?: string;
  mechanic?: 'compound' | 'isolation';
  trackingType?: ExerciseTrackingType;
  defaultSets?: number;
  defaultReps?: number | string;
  defaultRestSeconds?: number;
  instructions?: string[];
  imageUrl?: string | null;
}

export const EQUIPMENT_LABELS: Record<ExerciseEquipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Makine',
  cable: 'Kablo',
  bodyweight: 'Vücut Ağırlığı',
  kettlebell: 'Kettlebell',
  band: 'Direnç Bandı',
  smith: 'Smith Machine',
  ezbar: 'Z-Bar',
  cardio: 'Kardiyo Ekipmanı',
  other: 'Diğer',
};

export const TRACKING_LABELS: Record<ExerciseTrackingType, string> = {
  weight_reps: 'Ağırlık × tekrar',
  reps: 'Sadece tekrar',
  duration: 'Süre',
  distance: 'Mesafe',
};
