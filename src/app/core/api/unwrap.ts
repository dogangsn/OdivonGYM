import {
  EMPTY,
  Observable,
  catchError,
  distinctUntilChanged,
  fromEvent,
  interval,
  map,
  merge,
  of,
  startWith,
  switchMap,
} from 'rxjs';
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
 * Periyodik yenileme yalnızca sekme görünürken çalışır; arka plandaki sekme API'ye istek atmaz.
 * Sekme yeniden görünür olunca hemen bir kez yeniler.
 */
function visiblePolling(refreshMs: number): Observable<unknown> {
  if (typeof document === 'undefined') {
    return interval(refreshMs);
  }
  return fromEvent(document, 'visibilitychange').pipe(
    map(() => !document.hidden),
    startWith(!document.hidden),
    distinctUntilChanged(),
    switchMap((visible, index) => {
      if (!visible) return EMPTY;
      return index === 0 ? interval(refreshMs) : interval(refreshMs).pipe(startWith(0));
    }),
  );
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
      const triggers = refreshMs ? merge(reload$, visiblePolling(refreshMs)) : reload$;
      return triggers.pipe(
        startWith(null),
        switchMap(() => (refreshMs ? load().pipe(catchError(() => EMPTY)) : load())),
      );
    }),
  );
}
