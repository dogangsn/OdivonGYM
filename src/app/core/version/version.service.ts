import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { AuthService } from '../auth/auth.service';
import { BUILD_INFO, BuildInfo } from './build-info';
import { compareVersions, PRESERVED_STORAGE_KEYS } from './version-compare';

const CHECK_INTERVAL_MS = 5 * 60_000;
const POSTPONE_MS = 30 * 60_000;
const POSTPONE_KEY = 'odivongym-update-postponed';

/**
 * Tells the user when a new panel release is deployed and applies it cleanly.
 *
 * Detection: the Angular service worker (`SwUpdate`) plus `/version.json`, which is served
 * no-cache and compared with the build id compiled into this bundle. Checked on start, every
 * 5 minutes and whenever the tab becomes visible, so open tabs notice a deploy without a reload.
 *
 * Applying: clears Cache Storage and local/session storage (except theme and language), signs out
 * (Firebase keeps its session in IndexedDB), activates the new service-worker version and reloads
 * to the login page. A release marked critical (`forceLogout`, or this build below `minVersion`)
 * cannot be postponed.
 */
@Injectable({ providedIn: 'root' })
export class VersionService {
  // Optional: tests and builds without a service worker fall back to /version.json polling.
  private readonly sw = inject(SwUpdate, { optional: true });
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly current: BuildInfo = BUILD_INFO;
  readonly available = signal<BuildInfo | null>(null);
  readonly applying = signal(false);
  private readonly postponedUntil = signal(readPostponed());
  private readonly forced = signal(false);

  readonly mandatory = computed(() => {
    const next = this.available();
    if (this.forced()) return true;
    if (!next) return false;
    return next.forceLogout || (!!next.minVersion && compareVersions(this.current.version, next.minVersion) < 0);
  });

  readonly showBanner = computed(() => {
    if (!this.available() && !this.forced()) return false;
    return this.mandatory() || Date.now() >= this.postponedUntil();
  });

  private started = false;

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    if (this.sw?.isEnabled) {
      const sub = this.sw.versionUpdates.subscribe((event) => {
        if (event.type === 'VERSION_READY') void this.checkRemote();
      });
      this.destroyRef.onDestroy(() => sub.unsubscribe());
    }
    void this.check();
    const timer = window.setInterval(() => void this.check(), CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) void this.check();
    };
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  /** The API refused this build (426): updating is the only way forward. */
  forceUpdate(): void {
    this.forced.set(true);
    void this.checkRemote();
  }

  postpone(): void {
    if (this.mandatory()) return;
    const until = Date.now() + POSTPONE_MS;
    this.postponedUntil.set(until);
    try {
      sessionStorage.setItem(POSTPONE_KEY, String(until));
    } catch {
      // storage unavailable: postpone only for this page
    }
  }

  async applyUpdate(): Promise<void> {
    if (this.applying()) return;
    this.applying.set(true);
    try {
      await this.auth.logOut().catch(() => undefined);
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys().catch(() => [] as string[]);
        await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)));
      }
      clearStorage();
      if (this.sw?.isEnabled) {
        await this.sw.activateUpdate().catch(() => false);
      }
    } finally {
      window.location.replace('/auth/login?updated=1');
    }
  }

  private async check(): Promise<void> {
    if (this.sw?.isEnabled) {
      await this.sw.checkForUpdate().catch(() => false);
    }
    await this.checkRemote();
  }

  private async checkRemote(): Promise<void> {
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'ngsw-bypass': 'true' },
      });
      if (!response.ok) return;
      const remote = (await response.json()) as BuildInfo;
      if (remote?.buildId && remote.buildId !== this.current.buildId) {
        this.available.set(remote);
      }
    } catch {
      // offline or version.json missing (local dev): try again on the next check
    }
  }
}

function clearStorage(): void {
  try {
    const kept = PRESERVED_STORAGE_KEYS.map((key) => [key, localStorage.getItem(key)] as const);
    localStorage.clear();
    for (const [key, value] of kept) if (value !== null) localStorage.setItem(key, value);
    sessionStorage.clear();
  } catch {
    // private mode / blocked storage: nothing to clear
  }
}

function readPostponed(): number {
  try {
    return Number(sessionStorage.getItem(POSTPONE_KEY)) || 0;
  } catch {
    return 0;
  }
}
