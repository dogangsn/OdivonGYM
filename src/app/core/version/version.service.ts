import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { AuthService } from '../auth/auth.service';
import { BUILD_INFO, BuildInfo } from './build-info';
import { compareVersions, PRESERVED_STORAGE_KEYS } from './version-compare';

const CHECK_INTERVAL_MS = 5 * 60_000;

/**
 * Tells the user when a new panel release is deployed and applies it cleanly.
 *
 * Detection: the Angular service worker (`SwUpdate`) plus `/version.json`, which is served
 * no-cache and compared with the build id compiled into this bundle. Checked on start, every
 * 5 minutes and whenever the tab becomes visible, so open tabs notice a deploy without a reload.
 *
 * Every new release is mandatory (product decision): a blocking dialog with a single "update"
 * action that signs out (Firebase keeps its session in IndexedDB), clears Cache Storage and
 * local/session storage (except theme and language), activates the new service-worker version and
 * reloads to the login page. `forceLogout` / `minVersion` in release.json and a 426 from the API
 * lead to the same dialog.
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
  private readonly forced = signal(false);

  readonly manualOpen = signal(false);
  readonly isChecking = signal(false);
  readonly lastCheckedAt = signal<Date | null>(null);

  /** A newer release is deployed (or the API refused this build): the update dialog is shown. */
  readonly updateRequired = computed(() => this.forced() || this.available() !== null);

  /** Modal is visible if an update is required or if opened manually for release info. */
  readonly modalVisible = computed(() => this.updateRequired() || this.manualOpen());

  /** Release marked critical in release.json (only changes the wording of the dialog). */
  readonly critical = computed(() => {
    const next = this.available();
    if (this.forced()) return true;
    if (!next) return false;
    return next.forceLogout || (!!next.minVersion && compareVersions(this.current.version, next.minVersion) < 0);
  });

  openModal(): void {
    this.manualOpen.set(true);
  }

  closeModal(): void {
    this.manualOpen.set(false);
    this.available.set(null);
  }

  async checkNow(): Promise<void> {
    if (this.isChecking()) return;
    this.isChecking.set(true);
    try {
      await this.check();
      this.lastCheckedAt.set(new Date());
    } finally {
      this.isChecking.set(false);
    }
  }

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
    // Yerel geliştirme ortamında (localhost) test/derleme sırasında otomatik modal kilitlemesini engelle
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      !this.manualOpen()
    ) {
      return;
    }
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
