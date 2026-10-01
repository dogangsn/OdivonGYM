import { Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  distinctUntilChanged,
  firstValueFrom,
  map,
  merge,
  of,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { AccessApi } from '../../core/api/access.api';
import { tenantReload, tenantReloadValue, visiblePolling } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import {
  AccessDirection,
  AccessLog,
  AccessMethod,
  AccessStatus,
  CreateAccessLogInput,
} from '../../core/models/access-log.model';
import { UserProfile } from '../../core/models/user-profile.model';

/** Cihaz protokolü; MainApi `capabilities` ve `adapterStatus` değerlerini buna göre türetir. */
export type DeviceProtocol = 'yt-http-digest' | 'zk-tcp-4370' | 'vendor-sdk';

export const DEVICE_PROTOCOLS: { value: DeviceProtocol; label: string; hint: string; defaultPort: number }[] = [
  {
    value: 'yt-http-digest',
    label: 'YT HTTP (Digest)',
    hint: 'Olay okuma ve kart / üye no / bitiş günü senkronu. Canlı kullanım öncesi donanım testi gerekir.',
    defaultPort: 80,
  },
  {
    value: 'zk-tcp-4370',
    label: 'ZK TCP / 4370',
    hint: 'Tanımlı, henüz gerçek cihazla doğrulanmadı. Cihaza hiçbir şey yazılmaz.',
    defaultPort: 4370,
  },
  {
    value: 'vendor-sdk',
    label: 'Üretici SDK',
    hint: 'Tanımlı, adapter henüz eklenmedi.',
    defaultPort: 0,
  },
];

export interface DeviceCapabilities {
  events: boolean;
  userSync: boolean;
  doorOpen: boolean;
}

export interface TurnstileGate {
  id?: string;
  tenantId: string;
  name: string;
  location: string;
  direction: AccessDirection | 'both';
  readerType: string;
  protocol?: DeviceProtocol;
  host?: string;
  port?: number | null;
  agentId?: string | null;
  /** Sunucu türetir; istemci yazmaz. */
  capabilities?: DeviceCapabilities;
  adapterStatus?: 'ready' | 'hardware_pending' | 'not_validated';
  /** Agent heartbeat'inden hesaplanır. */
  online?: boolean;
  lastSeenAt?: string | null;
  lastError?: string | null;
  createdAt?: unknown;
  /** Eski kayıtlar (v1 agent) için. */
  endpoint?: string;
}

export type CreateGateInput = Pick<TurnstileGate, 'name' | 'location' | 'direction' | 'readerType' | 'protocol' | 'host' | 'port'>;

export interface AccessAgent {
  id: string;
  name: string;
  hostname?: string;
  agentVersion?: string;
  gateIds: string[];
  lastHeartbeatAt?: string | null;
  online?: boolean;
  revokedAt?: string | null;
}

export type DeviceSyncStatus = 'pending' | 'delivered' | 'applied' | 'error';

export interface DeviceSyncItem {
  id: string;
  gateId: string;
  memberId: string;
  userId: string;
  name: string;
  card?: string | null;
  validEnd?: string | null;
  enabled: boolean;
  version: number;
  status: DeviceSyncStatus;
  appliedVersion?: number | null;
  lastError?: string | null;
  updatedAt?: string | null;
}

export type DeviceSyncSummary = Record<string, Partial<Record<DeviceSyncStatus, number>>>;

/**
 * Canlı yenileme açıkken geçiş kayıtları bu aralıkla okunur (yalnızca sekme görünürken ve Edge
 * Agent ile turnike cihazı çevrimiçiyken).
 */
export const ACCESS_REFRESH_MS = 10000;
/** Cihaz / agent durumu ve kapı listesi bu yavaş aralıkla yenilenir. */
export const ACCESS_STATUS_MS = 60000;

export interface GateScanResult {
  allowed: boolean;
  status: AccessStatus;
  message: string;
  userName: string;
  userPhoto?: string | null;
  gateName: string;
  timestamp: Date;
}

/**
 * Kayıt yenileme tetikleri: ayar açık VE cihazlar çevrimiçi olduğu sürece `poll()` akışı;
 * ayar kapanınca veya cihaz/agent çevrimdışı olunca durur. Cihaz durumu yalnızca ayar açıkken izlenir.
 */
export function accessLiveTicks(
  liveRefresh$: Observable<boolean>,
  devicesOnline$: Observable<boolean>,
  poll: () => Observable<unknown>,
  onActive: (active: boolean) => void = () => undefined,
): Observable<unknown> {
  return liveRefresh$.pipe(
    switchMap((on) => (on ? devicesOnline$ : of(false))),
    distinctUntilChanged(),
    tap(onActive),
    switchMap((active) => (active ? poll() : EMPTY)),
  );
}

@Injectable({ providedIn: 'root' })
export class AdminAccessControlService {
  private readonly api = inject(AccessApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();
  private readonly settingsChanged$ = new Subject<void>();

  /** Salon ayarı (sunucuda): kapalıyken kayıtlar sayfa açılışında ve "Yenile" ile okunur. */
  readonly liveRefresh = signal(false);
  /** Canlı yenileme şu an çalışıyor mu (ayar açık + agent ve cihaz çevrimiçi). */
  readonly liveActive = signal(false);

  private readonly liveRefresh$ = this.profile$.pipe(
    switchMap((profile) =>
      profile?.tenantId
        ? this.settingsChanged$.pipe(
            startWith(null),
            switchMap(() => this.api.settings().pipe(catchError(() => of({ liveRefresh: false })))),
            map((settings) => settings.liveRefresh === true),
          )
        : of(false),
    ),
    tap((on) => this.liveRefresh.set(on)),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** En az bir kapı çevrimiçi mi (sunucu: agent heartbeat'i ve cihaz erişimi taze). */
  private readonly devicesOnline$ = visiblePolling(ACCESS_STATUS_MS).pipe(
    startWith(null),
    switchMap(() => this.api.listGates().pipe(catchError(() => of([])))),
    map((gates) => (gates as TurnstileGate[]).some((gate) => gate.online === true)),
    distinctUntilChanged(),
  );

  /** Yalnızca ayar açıkken ve cihazlar çevrimiçiyken kayıt yenileme tetikleri üretir. */
  private readonly liveTicks$: Observable<unknown> = accessLiveTicks(
    this.liveRefresh$,
    this.devicesOnline$,
    () => visiblePolling(ACCESS_REFRESH_MS),
    (active) => this.liveActive.set(active),
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  refresh(): void {
    this.reload$.next();
  }

  async setLiveRefresh(liveRefresh: boolean): Promise<void> {
    await firstValueFrom(this.api.saveSettings({ liveRefresh }));
    this.settingsChanged$.next();
  }

  watchGates(): Observable<TurnstileGate[]> {
    return tenantReload(
      this.profile$,
      this.reload$,
      () => this.api.listGates() as Observable<TurnstileGate[]>,
      ACCESS_STATUS_MS,
    );
  }

  watchAgents(): Observable<AccessAgent[]> {
    return tenantReload(
      this.profile$,
      this.reload$,
      () => this.api.listAgents() as Observable<AccessAgent[]>,
      ACCESS_STATUS_MS,
    );
  }

  watchSyncSummary(): Observable<DeviceSyncSummary> {
    return tenantReloadValue(
      this.profile$,
      this.reload$,
      () => this.api.syncSummary() as Observable<DeviceSyncSummary>,
      {} as DeviceSyncSummary,
      ACCESS_STATUS_MS,
    );
  }

  async listSync(gateId: string, status?: DeviceSyncStatus): Promise<DeviceSyncItem[]> {
    return (await firstValueFrom(this.api.listSync({ gateId, status }))) as DeviceSyncItem[];
  }

  async resync(gateId: string): Promise<void> {
    await firstValueFrom(this.api.resync(gateId));
    this.reload$.next();
  }

  async createPairingCode(gateIds: string[]): Promise<{ code: string; expiresAt: string }> {
    return firstValueFrom(this.api.createPairingCode(gateIds));
  }

  async revokeAgent(agentId: string): Promise<void> {
    await firstValueFrom(this.api.revokeAgent(agentId));
    this.reload$.next();
  }

  async createGate(input: CreateGateInput): Promise<string> {
    const created = await firstValueFrom(this.api.createGate(input));
    this.reload$.next();
    return (created as TurnstileGate).id ?? '';
  }

  async deleteGate(gateId: string): Promise<void> {
    await firstValueFrom(this.api.removeGate(gateId));
    this.reload$.next();
  }

  async seedDefaultGatesIfEmpty(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Geçiş kayıtları: açılışta bir kez ve "Yenile" ile; canlı yenileme ayarı açıksa agent ve cihaz
   * çevrimiçi olduğu sürece arka planda (sekme görünürken) da yenilenir.
   */
  watchLogs(): Observable<AccessLog[]> {
    return this.profile$.pipe(
      switchMap((profile) =>
        profile?.tenantId
          ? merge(this.reload$, this.liveTicks$).pipe(
              startWith(null),
              switchMap(() => this.api.listLogs().pipe(catchError(() => EMPTY))),
            )
          : of([] as AccessLog[]),
      ),
    );
  }

  async logAccess(input: CreateAccessLogInput): Promise<string> {
    const created = await firstValueFrom(this.api.createLog(input));
    this.reload$.next();
    return created.id;
  }

  async processGateScan(
    member: UserProfile,
    direction: AccessDirection,
    gateName: string,
    method: AccessMethod = 'qr',
  ): Promise<GateScanResult> {
    const result = (await firstValueFrom(
      this.api.scan({
        uid: member.uid,
        userId: member.uid,
        direction,
        gateName,
        method,
      }),
    )) as GateScanResult & { timestamp?: string };
    this.reload$.next();
    return {
      allowed: !!result.allowed,
      status: result.status,
      message: result.message,
      userName: result.userName,
      userPhoto: result.userPhoto,
      gateName: result.gateName || gateName,
      timestamp: result.timestamp ? new Date(result.timestamp) : new Date(),
    };
  }

  async validateAndProcessDynamicQrToken(
    tokenRaw: string,
    direction: AccessDirection = 'in',
    gateName: string = 'Turnike Okuyucu',
  ): Promise<GateScanResult> {
    let payload: { uid?: string; exp?: number; name?: string; token?: string };
    try {
      payload = JSON.parse(tokenRaw);
    } catch {
      payload = { uid: tokenRaw.trim() };
    }
    if (payload.token) {
      const result = (await firstValueFrom(
        this.api.scan({ token: payload.token, direction, gateName, method: 'qr' }),
      )) as GateScanResult & { timestamp?: string };
      this.reload$.next();
      return {
        allowed: !!result.allowed,
        status: result.status,
        message: result.message,
        userName: result.userName,
        userPhoto: result.userPhoto,
        gateName: result.gateName || gateName,
        timestamp: result.timestamp ? new Date(result.timestamp) : new Date(),
      };
    }
    const uid = payload.uid;
    if (!uid) {
      throw new Error('Geçersiz QR kod veya kimlik bilgisi.');
    }
    if (payload.exp && Date.now() > payload.exp + 15000) {
      return {
        allowed: false,
        status: 'denied',
        message: 'Dinamik QR kodun süresi dolmuş. Lütfen uygulamadaki QR kodunu yenileyin.',
        userName: payload.name || 'Bilinmeyen Üye',
        gateName,
        timestamp: new Date(),
      };
    }
    const result = (await firstValueFrom(
      this.api.scan({ uid, userId: uid, direction, gateName, method: 'qr' }),
    )) as GateScanResult & { timestamp?: string };
    this.reload$.next();
    return {
      allowed: !!result.allowed,
      status: result.status,
      message: result.message,
      userName: result.userName,
      userPhoto: result.userPhoto,
      gateName: result.gateName || gateName,
      timestamp: result.timestamp ? new Date(result.timestamp) : new Date(),
    };
  }
}
