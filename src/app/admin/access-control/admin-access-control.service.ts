import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { AccessApi } from '../../core/api/access.api';
import { tenantReload } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import {
  AccessDirection,
  AccessLog,
  AccessMethod,
  AccessStatus,
  CreateAccessLogInput,
} from '../../core/models/access-log.model';
import { UserProfile } from '../../core/models/user-profile.model';

export type TurnstileConnectionProtocol = 'reverse_tunnel' | 'mqtt' | 'websocket';

export interface TurnstileGate {
  id?: string;
  tenantId: string;
  name: string;
  location: string;
  direction: AccessDirection | 'both';
  status: 'online' | 'busy' | 'offline';
  readerType: string;
  connectionProtocol: TurnstileConnectionProtocol;
  endpoint: string;
  topicOrChannel?: string;
  port?: number | null;
  secretToken?: string | null;
  createdAt?: unknown;
}

export interface GateScanResult {
  allowed: boolean;
  status: AccessStatus;
  message: string;
  userName: string;
  userPhoto?: string | null;
  gateName: string;
  timestamp: Date;
}

@Injectable({ providedIn: 'root' })
export class AdminAccessControlService {
  private readonly api = inject(AccessApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  watchGates(): Observable<TurnstileGate[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.listGates() as Observable<TurnstileGate[]>);
  }

  async createGate(input: Omit<TurnstileGate, 'id' | 'tenantId' | 'createdAt'>): Promise<string> {
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

  watchLogs(): Observable<AccessLog[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.listLogs());
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

  async manualGateOpen(gateName: string, reason: string): Promise<void> {
    const admin = this.auth.profile();
    await this.logAccess({
      userName: admin?.displayName || 'Resepsiyon Yöneticisi',
      userPhoto: admin?.photoURL,
      direction: 'in',
      method: 'manual',
      status: 'granted',
      gateName,
      notes: `Manuel kapı açma: ${reason}`,
    });
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

  async requestDeviceSync(): Promise<void> {
    await firstValueFrom(this.api.queueCommand({ command: 'PULL_LOGS_NOW', targetDevice: 'ALL_GATES' }));
  }

  async queueMemberDeviceSync(
    userId: string,
    displayName: string,
    action: 'ENABLE' | 'DISABLE' | 'UPDATE_EXPIRY',
    endsAt?: Date,
    cardNo?: string,
  ): Promise<void> {
    await firstValueFrom(
      this.api.queueCommand({
        command: action,
        userId,
        displayName,
        notes: cardNo || (endsAt ? endsAt.toISOString() : ''),
      }),
    );
  }
}
