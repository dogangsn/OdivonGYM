import {
  renameWorkoutDay,
  shiftAfterRemovedDay,
  shiftPendingNames,
  workoutDayIndex,
  workoutDayLabel,
  workoutDayName,
  workoutDayTabs,
} from './workout-day';
import { WorkoutDayState } from './workout-day-state';

describe('workout-day', () => {
  it('builds and parses numbered day labels', () => {
    expect(workoutDayLabel(2)).toBe('2. Gün');
    expect(workoutDayLabel(2, ' Çekiş ')).toBe('2. Gün: Çekiş');
    expect(workoutDayIndex('3. Gün: Bacak')).toBe(3);
    expect(workoutDayIndex(undefined)).toBe(1);
    expect(workoutDayName('3. Gün: Bacak')).toBe('Bacak');
    expect(workoutDayName('1. Gün')).toBe('');
  });

  it('lists tabs with names, counts and empty days', () => {
    const tabs = workoutDayTabs(['1. Gün: İtiş', '1. Gün: İtiş', '2. Gün'], 3, { 3: 'Bacak' });
    expect(tabs).toEqual([
      { day: 1, name: 'İtiş', count: 2 },
      { day: 2, name: '', count: 1 },
      { day: 3, name: 'Bacak', count: 0 },
    ]);
  });

  it('renames only the given day', () => {
    expect(renameWorkoutDay('2. Gün', 2, 'Çekiş')).toBe('2. Gün: Çekiş');
    expect(renameWorkoutDay('1. Gün: İtiş', 2, 'Çekiş')).toBe('1. Gün: İtiş');
    expect(renameWorkoutDay('2. Gün: Çekiş', 2, '')).toBe('2. Gün');
  });

  it('shifts later days down when a day is removed', () => {
    expect(shiftAfterRemovedDay('2. Gün: Çekiş', 2)).toBeNull();
    expect(shiftAfterRemovedDay('3. Gün: Bacak', 2)).toBe('2. Gün: Bacak');
    expect(shiftAfterRemovedDay('1. Gün: İtiş', 2)).toBe('1. Gün: İtiş');
    expect(shiftPendingNames({ 1: 'A', 2: 'B', 3: 'C' }, 2)).toEqual({ 1: 'A', 2: 'C' });
  });
});

describe('WorkoutDayState', () => {
  function setup(initial: string[]) {
    let names: (string | null)[] = [...initial];
    const state = new WorkoutDayState(
      () => names,
      (map) => {
        names = names.map(map).filter((name) => name !== null);
      },
    );
    return { state, names: () => names };
  }

  it('names an empty day before any exercise is added', () => {
    const { state } = setup(['1. Gün: İtiş']);
    state.add();
    expect(state.active()).toBe(2);
    state.rename(2, 'Çekiş');
    expect(state.label()).toBe('2. Gün: Çekiş');
  });

  it('removes a day with its exercises and selects the next one', () => {
    const { state, names } = setup(['1. Gün: İtiş', '2. Gün: Çekiş', '3. Gün: Bacak']);
    state.reset();
    state.active.set(2);
    state.remove(2);
    expect(names()).toEqual(['1. Gün: İtiş', '2. Gün: Bacak']);
    expect(state.active()).toBe(2);
    expect(state.tabs().map((tab) => tab.name)).toEqual(['İtiş', 'Bacak']);
  });
});
