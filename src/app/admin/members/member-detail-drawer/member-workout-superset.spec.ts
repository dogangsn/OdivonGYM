import { Exercise } from '../../../core/models/workout-plan.model';

describe('Workout Plan SuperSet Logic', () => {
  it('should support adding an exercise with a linked superset', () => {
    const superSet: Exercise = {
      id: 'ex-ss-1',
      name: 'Dumbbell Flye',
      muscleGroup: 'chest',
      equipmentName: 'Açılı Sehpa',
      sets: 4,
      reps: '12',
      weight: 14,
      restSeconds: 0,
      notes: 'Hemen ardından dinlenmeden yapın',
    };

    const primaryEx: Exercise = {
      id: 'ex-1',
      name: 'Incline Dumbbell Press',
      muscleGroup: 'chest',
      equipmentName: 'Açılı Sehpa & Dumbbell',
      sets: 4,
      reps: '10',
      weight: 26,
      restSeconds: 90,
      superSet,
    };

    expect(primaryEx.superSet).toBeDefined();
    expect(primaryEx.superSet?.name).toBe('Dumbbell Flye');
    expect(primaryEx.superSet?.restSeconds).toBe(0);
  });

  it('should calculate total supersets and total movements count accurately', () => {
    const exercises: Exercise[] = [
      {
        id: '1',
        name: 'Bench Press',
        sets: 4,
        reps: 10,
        superSet: { id: '1b', name: 'Cable Fly', sets: 4, reps: 12 },
      },
      {
        id: '2',
        name: 'Lat Pulldown',
        sets: 4,
        reps: 12,
      },
      {
        id: '3',
        name: 'Biceps Curl',
        sets: 3,
        reps: 10,
        superSet: { id: '3b', name: 'Triceps Pushdown', sets: 3, reps: 12 },
      },
    ];

    const totalSuperSets = exercises.filter((e) => !!e.superSet).length;
    const totalMovements = exercises.length + totalSuperSets;

    expect(exercises.length).toBe(3);
    expect(totalSuperSets).toBe(2);
    expect(totalMovements).toBe(5);
  });

  it('should remove/unlink superset without affecting primary movement', () => {
    let exercise: Exercise = {
      id: 'ex-1',
      name: 'Barbell Squat',
      sets: 4,
      reps: 10,
      superSet: {
        id: 'ex-ss-1',
        name: 'Lying Leg Curl',
        sets: 4,
        reps: 12,
      },
    };

    expect(exercise.superSet).toBeDefined();

    // Unlink superset
    const unlinked: Exercise = { ...exercise };
    delete unlinked.superSet;

    expect(unlinked.superSet).toBeUndefined();
    expect(unlinked.name).toBe('Barbell Squat');
    expect(unlinked.sets).toBe(4);
  });
});
