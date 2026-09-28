import { EMPTY, Observable, catchError, interval, merge, of, startWith, switchMap } from 'rxjs';
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
  refreshMs?: number,
): Observable<T[]> {
  return tenantReloadValue(profile$, reload$, load, [] as T[], refreshMs);
}

/**
 * Tenant hazır olunca yükler; `reload$` ile ve (verilirse) `refreshMs` aralığıyla yeniler.
 * Periyodik yenilemede bir istek hata verirse akış kopmaz, son değer korunur.
 */
export function tenantReloadValue<T>(
  profile$: Observable<UserProfile | null | undefined>,
  reload$: Subject<void>,
  load: () => Observable<T>,
  empty: T,
  refreshMs?: number,
): Observable<T> {
  return profile$.pipe(
    switchMap((profile) => {
      if (!profile?.tenantId) {
        return of(empty);
      }
      const triggers = refreshMs ? merge(reload$, interval(refreshMs)) : reload$;
      return triggers.pipe(
        startWith(null),
        switchMap(() => (refreshMs ? load().pipe(catchError(() => EMPTY)) : load())),
      );
    }),
  );
}
