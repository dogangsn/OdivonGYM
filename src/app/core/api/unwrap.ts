import { Observable, of, startWith, switchMap } from 'rxjs';
import { Subject } from 'rxjs';
import type { UserProfile } from '../models/user-profile.model';

export function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }
  if (data && typeof data === 'object' && Array.isArray((data as { items?: T[] }).items)) {
    return (data as { items: T[] }).items;
  }
  return [];
}

export function tenantReload<T>(
  profile$: Observable<UserProfile | null | undefined>,
  reload$: Subject<void>,
  load: () => Observable<T[]>,
): Observable<T[]> {
  return profile$.pipe(
    switchMap((profile) => {
      if (!profile?.tenantId) {
        return of([] as T[]);
      }
      return reload$.pipe(
        startWith(null),
        switchMap(() => load()),
      );
    }),
  );
}
