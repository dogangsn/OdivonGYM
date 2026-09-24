import { Timestamp } from '@angular/fire/firestore';
import { Exercise } from './workout-plan.model';

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
export type ProgramGoal = 'fullbody' | 'split' | 'fat_loss' | 'hypertrophy' | 'strength';

export const FITNESS_LEVEL_LABELS: Record<FitnessLevel, string> = {
  beginner: 'Başlangıç Seviyesi',
  intermediate: 'Orta Seviye',
  advanced: 'İleri Seviye (Pro)',
};

export const PROGRAM_GOAL_LABELS: Record<ProgramGoal, string> = {
  fullbody: 'Tüm Vücut (Full Body)',
  split: 'Bölgesel Split',
  fat_loss: 'Yağ Yakımı & Kondisyon',
  hypertrophy: 'Hacim & Hipertrofi',
  strength: 'Güç & Kuvvet',
};

export interface WorkoutTemplate {
  id: string;
  tenantId: string;
  title: string;
  level: FitnessLevel;
  goal: ProgramGoal;
  targetDaysPerWeek: number;
  description: string;
  disciplineId?: string | null;
  exercises: Exercise[];
  isSystemDefault?: boolean;
  createdByTrainerId?: string | null;
  createdByTrainerName?: string | null;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface CreateWorkoutTemplateInput {
  title: string;
  level: FitnessLevel;
  goal: ProgramGoal;
  targetDaysPerWeek: number;
  description: string;
  disciplineId?: string | null;
  exercises: Exercise[];
}

/**
 * Sisteme hazır gelen profesyonel antrenman şablonları
 */
export const SYSTEM_WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  // 1. Yeni Başlayanlar İçin Full Body (3 Günlük)
  {
    id: 'sys-tpl-beginner-fullbody',
    tenantId: 'system',
    title: 'Yeni Başlayanlar İçin 3 Günlük Full Body',
    level: 'beginner',
    goal: 'fullbody',
    targetDaysPerWeek: 3,
    description: 'Spor salonuna yeni başlayan üyeler için temel hareket adaptasyonu, eklem güçlendirme ve form oturtma programı.',
    isSystemDefault: true,
    createdByTrainerName: 'Odivon Baş Antrenör',
    exercises: [
      { name: 'Chest Press Makinesi', muscleGroup: 'chest', equipmentName: 'Chest Press Makinesi', sets: 3, reps: '12-15', restSeconds: 60, notes: 'Omuzları geride sabitleyin, kontrollü itin' },
      { name: 'Lat Pulldown', muscleGroup: 'back', equipmentName: 'Lat Pulldown Makinesi', sets: 3, reps: '12', restSeconds: 60, notes: 'Göğse doğru çekin, sırtta 1 sn sıkıştırın' },
      { name: 'Leg Press 45°', muscleGroup: 'legs', equipmentName: 'Leg Press Makinesi', sets: 3, reps: '12-15', restSeconds: 75, notes: 'Dizleri kitlemeden 90 derece bükün' },
      { name: 'Dumbbell Shoulder Press', muscleGroup: 'shoulders', equipmentName: 'Dumbbell & Sehpa', sets: 3, reps: '10-12', restSeconds: 60, notes: 'Hafif ağırlıkla doğru açıya odaklanın' },
      { name: 'Barbell Biceps Curl', muscleGroup: 'arms', equipmentName: 'Z-Bar', sets: 3, reps: '12', restSeconds: 45, notes: 'Dirsekleri vücuda yapışık tutun' },
      { name: 'Triceps Pushdown', muscleGroup: 'arms', equipmentName: 'Kablo & Düz Bar', sets: 3, reps: '12', restSeconds: 45, notes: 'Aşağıda dirsekleri tam açın' },
      { name: 'Plank', muscleGroup: 'core', equipmentName: 'Mat', sets: 3, reps: '30-45 sn', restSeconds: 45, notes: 'Bel çukuru oluşturmadan karın ve kalçayı sıkın' },
    ],
  },

  // 2. Orta Seviye İtiş - Çekiş - Bacak (Push - Pull - Legs)
  {
    id: 'sys-tpl-intermediate-ppl',
    tenantId: 'system',
    title: 'Orta Seviye 3-4 Günlük İtiş / Çekiş / Bacak (PPL)',
    level: 'intermediate',
    goal: 'split',
    targetDaysPerWeek: 4,
    description: 'En popüler ve bilimsel olarak kanıtlanmış hipertrofi spliti. İtiş (Göğüs-Omuz-Triceps), Çekiş (Sırt-Biceps) ve Bacak/Karın.',
    isSystemDefault: true,
    createdByTrainerName: 'Odivon Baş Antrenör',
    exercises: [
      { dayName: '1. Gün: İtiş (Push)', name: 'Barbell Bench Press', muscleGroup: 'chest', equipmentName: 'Düz Sehpa & Barbell', sets: 4, reps: '8-10', restSeconds: 90, notes: 'Ağırlığı kontrollü indirin' },
      { dayName: '1. Gün: İtiş (Push)', name: 'Incline Dumbbell Press', muscleGroup: 'chest', equipmentName: 'Açılı Sehpa & DB', sets: 3, reps: '10-12', restSeconds: 60, notes: 'Üst göğüs odaklı' },
      { dayName: '1. Gün: İtiş (Push)', name: 'Lateral Raise (Yan Omuz)', muscleGroup: 'shoulders', equipmentName: 'Dumbbell', sets: 4, reps: '12-15', restSeconds: 45, notes: 'Dirsekler hafif bükük' },
      { dayName: '1. Gün: İtiş (Push)', name: 'Dips / Bench Dips', muscleGroup: 'arms', equipmentName: 'Paralel Bar', sets: 3, reps: '10-12', restSeconds: 60, notes: 'Triceps odaklı dikey iniş' },
      { dayName: '2. Gün: Çekiş (Pull)', name: 'Lat Pulldown', muscleGroup: 'back', equipmentName: 'Lat Pulldown Makinesi', sets: 4, reps: '10-12', restSeconds: 60, notes: 'Geniş tutuş' },
      { dayName: '2. Gün: Çekiş (Pull)', name: 'Seated Cable Row', muscleGroup: 'back', equipmentName: 'Kablolu Row İstasyonu', sets: 4, reps: '10', restSeconds: 60, notes: 'Göbeğe doğru çekiş' },
      { dayName: '2. Gün: Çekiş (Pull)', name: 'Face Pull (Arka Omuz)', muscleGroup: 'shoulders', equipmentName: 'Kablo & Halat', sets: 3, reps: '15', restSeconds: 45, notes: 'Postür ve arka omuz' },
      { dayName: '2. Gün: Çekiş (Pull)', name: 'Hammer Curl', muscleGroup: 'arms', equipmentName: 'Dumbbell', sets: 3, reps: '12', restSeconds: 45, notes: 'Brachialis odaklı' },
      { dayName: '3. Gün: Bacak & Core', name: 'Barbell Squat', muscleGroup: 'legs', equipmentName: 'Squat Rack', sets: 4, reps: '8-10', restSeconds: 120, notes: 'Tam derinlikte kontrollü squat' },
      { dayName: '3. Gün: Bacak & Core', name: 'Lying Leg Curl (Arka Bacak)', muscleGroup: 'legs', equipmentName: 'Leg Curl Makinesi', sets: 4, reps: '12', restSeconds: 60, notes: 'Hamstring izolasyonu' },
      { dayName: '3. Gün: Bacak & Core', name: 'Hanging Leg Raise', muscleGroup: 'core', equipmentName: 'Barfiks Demiri', sets: 3, reps: '15', restSeconds: 45, notes: 'Alt karın odaklı' },
    ],
  },

  // 3. İleri Seviye 4 Günlük Hipertrofi Spliti
  {
    id: 'sys-tpl-advanced-split',
    tenantId: 'system',
    title: 'İleri Seviye 4 Günlük Bölgesel Hipertrofi Split',
    level: 'advanced',
    goal: 'hypertrophy',
    targetDaysPerWeek: 4,
    description: 'Deneyimli sporcular için maksimum kas yıkımı ve büyümesi sağlayan 4 günlük bölgesel split programı.',
    isSystemDefault: true,
    createdByTrainerName: 'Odivon Baş Antrenör',
    exercises: [
      { dayName: '1. Gün: Göğüs & Biceps', name: 'Barbell Bench Press', muscleGroup: 'chest', equipmentName: 'Olimpik Barbell', sets: 4, reps: '6-8', restSeconds: 90, notes: 'Piramit set uygulayın' },
      { dayName: '1. Gün: Göğüs & Biceps', name: 'Incline Dumbbell Press', muscleGroup: 'chest', equipmentName: 'Sehpa & DB', sets: 4, reps: '10', restSeconds: 60 },
      { dayName: '1. Gün: Göğüs & Biceps', name: 'Cable Crossover / Fly', muscleGroup: 'chest', equipmentName: 'Kablo İstasyonu', sets: 3, reps: '15', restSeconds: 45, notes: 'Zirvede 2 sn sıkıştırma' },
      { dayName: '1. Gün: Göğüs & Biceps', name: 'Barbell Biceps Curl', muscleGroup: 'arms', equipmentName: 'Z-Bar', sets: 4, reps: '10', restSeconds: 60 },
      { dayName: '2. Gün: Sırt & Triceps', name: 'Barbell Bent Over Row', muscleGroup: 'back', equipmentName: 'Barbell', sets: 4, reps: '8-10', restSeconds: 90 },
      { dayName: '2. Gün: Sırt & Triceps', name: 'Lat Pulldown', muscleGroup: 'back', equipmentName: 'Lat Makinesi', sets: 4, reps: '10-12', restSeconds: 60 },
      { dayName: '2. Gün: Sırt & Triceps', name: 'Triceps Pushdown', muscleGroup: 'arms', equipmentName: 'Kablo & Halat', sets: 4, reps: '12', restSeconds: 45 },
      { dayName: '3. Gün: Omuz & Karın', name: 'Dumbbell Shoulder Press', muscleGroup: 'shoulders', equipmentName: 'Dumbbell', sets: 4, reps: '8-10', restSeconds: 60 },
      { dayName: '3. Gün: Omuz & Karın', name: 'Lateral Raise (Yan Omuz)', muscleGroup: 'shoulders', equipmentName: 'Dumbbell', sets: 4, reps: '15', restSeconds: 45, notes: 'Drop set opsiyonel' },
      { dayName: '3. Gün: Omuz & Karın', name: 'Cable Crunch', muscleGroup: 'core', equipmentName: 'Kablo İstasyonu', sets: 4, reps: '15-20', restSeconds: 45 },
      { dayName: '4. Gün: Bacak & Kalf', name: 'Barbell Squat', muscleGroup: 'legs', equipmentName: 'Squat Rack', sets: 4, reps: '8-10', restSeconds: 120 },
      { dayName: '4. Gün: Bacak & Kalf', name: 'Leg Press 45°', muscleGroup: 'legs', equipmentName: 'Leg Press', sets: 4, reps: '12', restSeconds: 90 },
      { dayName: '4. Gün: Bacak & Kalf', name: 'Standing Calf Raise', muscleGroup: 'legs', equipmentName: 'Kalf Bloğu', sets: 4, reps: '20', restSeconds: 45 },
    ],
  },

  // 4. Fonksiyonel Yağ Yakımı & Dayanıklılık (Metabolik)
  {
    id: 'sys-tpl-fatloss-functional',
    tenantId: 'system',
    title: 'Fonksiyonel Yağ Yakımı & Metabolik Kondisyon',
    level: 'intermediate',
    goal: 'fat_loss',
    targetDaysPerWeek: 3,
    description: 'Kalp ritmini yüksek tutarak maksimum kalori harcanmasını sağlayan yüksek tempolu, kısa dinlenmeli fonksiyonel program.',
    isSystemDefault: true,
    createdByTrainerName: 'Odivon Baş Antrenör',
    exercises: [
      { name: 'Kettlebell Swing', muscleGroup: 'fullbody', equipmentName: 'Kettlebell', sets: 4, reps: '20', restSeconds: 30, notes: 'Kalçadan patlayıcı güç üretin' },
      { name: 'Dumbbell Thruster (Squat + Press)', muscleGroup: 'fullbody', equipmentName: 'Dumbbell', sets: 4, reps: '12', restSeconds: 45, notes: 'Kesintisiz akış' },
      { name: 'Barbell Bent Over Row', muscleGroup: 'back', equipmentName: 'Hafif Barbell', sets: 4, reps: '15', restSeconds: 30 },
      { name: 'Push-up (Şınav)', muscleGroup: 'chest', equipmentName: 'Mat', sets: 3, reps: 'Maksimum', restSeconds: 30 },
      { name: 'Mountain Climber', muscleGroup: 'core', equipmentName: 'Mat', sets: 4, reps: '30 sn', restSeconds: 30, notes: 'Hızlı tempo' },
      { name: 'Plank', muscleGroup: 'core', equipmentName: 'Mat', sets: 3, reps: '45 sn', restSeconds: 30 },
    ],
  },
];
