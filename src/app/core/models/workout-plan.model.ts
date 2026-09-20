import { Timestamp } from '@angular/fire/firestore';
import { MuscleGroup } from './gym-equipment.model';

export interface Exercise {
  id?: string;
  name: string;
  muscleGroup?: MuscleGroup; // 'chest' | 'back' | 'shoulders' | 'legs' | 'arms' | 'core' | 'fullbody'
  equipmentName?: string; // Örn: "Chest Press Makinesi" veya "Barbell"
  dayName?: string; // Örn: "1. Gün: Göğüs & Ön Kol (İtiş)"
  reps?: number | string; // Örn: 12 veya "10-12" veya "Tükeniş"
  sets?: number; // Örn: 4
  weight?: number; // kg
  restSeconds?: number; // Dinlenme süresi (sn)
  duration?: number; // seconds
  notes?: string; // Antrenör direktifi (Örn: "Zirvede 1 sn sıkıştır")
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  tenantId: string;
  templateId?: string; // Reference to trainer's template
  trainerId?: string;
  trainerName?: string; // Antrenör adı
  disciplineId?: string; // Hangi branş (Fitness, Kickboks vb.)
  title: string; // Örn: "4 Günlük Bölgesel Split Programı"
  description?: string;
  exercises: Exercise[];
  startDate: Timestamp;
  endDate?: Timestamp | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateWorkoutPlanInput {
  templateId?: string;
  trainerId?: string;
  trainerName?: string;
  disciplineId?: string;
  title: string;
  description?: string;
  exercises: Exercise[];
  startDate: Date;
  endDate?: Date | null;
  notes?: string;
}

export type UpdateWorkoutPlanInput = Partial<Omit<CreateWorkoutPlanInput, 'templateId'>> & { status?: WorkoutPlan['status'] };

/** Antrenörün hızlı program hazırlaması için hazır bölgesel egzersiz kütüphanesi */
export const DEFAULT_EXERCISE_LIBRARY: Exercise[] = [
  // GÖĞÜS (CHEST)
  { name: 'Barbell Bench Press', muscleGroup: 'chest', equipmentName: 'Düz Sehpa & Barbell', sets: 4, reps: 10, restSeconds: 90 },
  { name: 'Incline Dumbbell Press', muscleGroup: 'chest', equipmentName: 'Açılı Sehpa & Dumbbell', sets: 4, reps: 12, restSeconds: 60 },
  { name: 'Chest Press Makinesi', muscleGroup: 'chest', equipmentName: 'Chest Press Makinesi', sets: 3, reps: 12, restSeconds: 60 },
  { name: 'Cable Crossover / Fly', muscleGroup: 'chest', equipmentName: 'Çift Kablo İstasyonu', sets: 3, reps: 15, restSeconds: 45 },

  // SIRT & KANAT (BACK)
  { name: 'Lat Pulldown', muscleGroup: 'back', equipmentName: 'Lat Pulldown Makinesi', sets: 4, reps: 12, restSeconds: 60 },
  { name: 'Seated Cable Row', muscleGroup: 'back', equipmentName: 'Kablolu Row İstasyonu', sets: 4, reps: 10, restSeconds: 60 },
  { name: 'Barbell Bent Over Row', muscleGroup: 'back', equipmentName: 'Olimpik Barbell', sets: 4, reps: 10, restSeconds: 75 },
  { name: 'Hyperextension (Bel)', muscleGroup: 'back', equipmentName: 'Roma Sehpası', sets: 3, reps: 15, restSeconds: 45 },

  // OMUZ & TRAPEZ (SHOULDERS)
  { name: 'Dumbbell Shoulder Press', muscleGroup: 'shoulders', equipmentName: 'Dumbbell & Sehpa', sets: 4, reps: 10, restSeconds: 60 },
  { name: 'Lateral Raise (Yan Omuz)', muscleGroup: 'shoulders', equipmentName: 'Dumbbell', sets: 4, reps: 15, restSeconds: 45 },
  { name: 'Face Pull (Arka Omuz)', muscleGroup: 'shoulders', equipmentName: 'Kablo & Halat', sets: 3, reps: 15, restSeconds: 45 },
  { name: 'Barbell Shrug (Trapez)', muscleGroup: 'shoulders', equipmentName: 'Barbell', sets: 3, reps: 12, restSeconds: 60 },

  // BACAK & KALF (LEGS)
  { name: 'Leg Press 45°', muscleGroup: 'legs', equipmentName: 'Leg Press Makinesi', sets: 4, reps: 12, restSeconds: 90 },
  { name: 'Barbell Squat', muscleGroup: 'legs', equipmentName: 'Squat Rack / Smith Machine', sets: 4, reps: 10, restSeconds: 120 },
  { name: 'Leg Extension (Ön Bacak)', muscleGroup: 'legs', equipmentName: 'Leg Extension Makinesi', sets: 3, reps: 12, restSeconds: 45 },
  { name: 'Lying Leg Curl (Arka Bacak)', muscleGroup: 'legs', equipmentName: 'Leg Curl Makinesi', sets: 3, reps: 12, restSeconds: 45 },
  { name: 'Standing Calf Raise', muscleGroup: 'legs', equipmentName: 'Kalf Bloğu', sets: 4, reps: 15, restSeconds: 45 },

  // KOL (ARMS - BICEPS & TRICEPS)
  { name: 'Barbell Biceps Curl', muscleGroup: 'arms', equipmentName: 'Z-Bar / Düz Bar', sets: 4, reps: 10, restSeconds: 60 },
  { name: 'Hammer Curl', muscleGroup: 'arms', equipmentName: 'Dumbbell', sets: 3, reps: 12, restSeconds: 45 },
  { name: 'Triceps Pushdown', muscleGroup: 'arms', equipmentName: 'Kablo & Düz/Halat Bar', sets: 4, reps: 12, restSeconds: 45 },
  { name: 'Dips / Bench Dips', muscleGroup: 'arms', equipmentName: 'Paralel Bar / Sehpa', sets: 3, reps: 12, restSeconds: 60 },

  // KARIN & CORE (ABS)
  { name: 'Plank', muscleGroup: 'core', equipmentName: 'Mat', sets: 3, reps: '45 sn', restSeconds: 45 },
  { name: 'Hanging Leg Raise', muscleGroup: 'core', equipmentName: 'Barfiks Demiri', sets: 3, reps: 15, restSeconds: 45 },
  { name: 'Cable Crunch', muscleGroup: 'core', equipmentName: 'Kablo İstasyonu', sets: 4, reps: 15, restSeconds: 45 },
];
