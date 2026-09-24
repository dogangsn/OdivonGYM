import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  query,
  where,
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
} from '@angular/fire/firestore';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { UserProfile } from '../../core/models/user-profile.model';
import {
  AccessDirection,
  AccessLog,
  AccessMethod,
  AccessStatus,
  CreateAccessLogInput,
} from '../../core/models/access-log.model';

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
  createdAt?: any;
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
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchGates(): Observable<TurnstileGate[]> {
    return toObservable(this.auth.profile).pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId || profile?.uid;
        if (!tenantId) {
          return of([] as TurnstileGate[]);
        }

        const q = query(
          collection(this.firestore, 'turnstile_gates'),
          where('tenantId', '==', tenantId),
        );

        return (collectionData(q, { idField: 'id' }) as Observable<TurnstileGate[]>).pipe(
          catchError((err) => {
            console.warn('OdivonGYM: turnikeler dinlenirken hata:', err);
            return of([] as TurnstileGate[]);
          }),
        );
      }),
    );
  }

  async createGate(input: Omit<TurnstileGate, 'id' | 'tenantId' | 'createdAt'>): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId || this.auth.profile()?.uid;
    if (!tenantId) {
      throw new Error('Salon bilgisi bulunamadı');
    }

    const cleanData: Record<string, any> = {
      tenantId,
      createdAt: serverTimestamp(),
    };
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) {
        cleanData[k] = v;
      }
    }

    const docRef = await addDoc(collection(this.firestore, 'turnstile_gates'), cleanData);
    return docRef.id;
  }

  async deleteGate(gateId: string): Promise<void> {
    const docRef = doc(this.firestore, 'turnstile_gates', gateId);
    await deleteDoc(docRef);
  }

  /**
   * Statik / mock veri oluşturulmaz. Turnikeler yalnızca işletme yöneticisi tarafından
   * gerçek donanım bilgileriyle tanımlanır.
   */
  async seedDefaultGatesIfEmpty(): Promise<void> {
    // Sabit / sahte turnike verisi enjekte edilmez.
    return Promise.resolve();
  }

  watchLogs(): Observable<AccessLog[]> {
    return toObservable(this.auth.profile).pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId || profile?.uid;

        if (!tenantId) {
          return of([] as AccessLog[]);
        }

        const q = query(
          collection(this.firestore, 'access_logs'),
          where('tenantId', '==', tenantId),
        );

        return (collectionData(q, { idField: 'id' }) as Observable<AccessLog[]>).pipe(
          catchError((err) => {
            console.warn('OdivonGYM: turnike logları dinlenirken hata:', err);
            return of([] as AccessLog[]);
          }),
        );
      }),
    );
  }

  async logAccess(input: CreateAccessLogInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId || this.auth.profile()?.uid;

    if (!tenantId) {
      throw new Error('Salon bilgisi bulunamadı');
    }

    const docRef = await addDoc(collection(this.firestore, 'access_logs'), {
      tenantId,
      userId: input.userId || null,
      userName: input.userName,
      userPhoto: input.userPhoto || null,
      direction: input.direction,
      method: input.method,
      status: input.status,
      gateName: input.gateName,
      notes: input.notes || '',
      timestamp: serverTimestamp(),
    });

    return docRef.id;
  }

  async processGateScan(
    member: UserProfile,
    direction: AccessDirection,
    gateName: string,
    method: AccessMethod = 'qr',
  ): Promise<GateScanResult> {
    const now = Date.now();
    let status: AccessStatus = 'granted';
    let message = 'Geçiş onaylandı. İyi antrenmanlar!';
    let allowed = true;

    // 1. Membership Status Check
    if (member.membershipStatus === 'expired' || member.membershipStatus === 'cancelled') {
      status = 'denied';
      message = 'Geçiş reddedildi: Üyelik süresi dolmuş veya iptal edilmiş.';
      allowed = false;
    } else if (member.membershipStatus === 'trial') {
      const trialEnds = member.trialEndsAt?.toMillis() ?? 0;
      if (trialEnds <= now) {
        status = 'denied';
        message = 'Geçiş reddedildi: 14 günlük deneme süresi sona ermiş.';
        allowed = false;
      }
    } else if (member.membershipStatus === 'active' && member.membershipEndsAt) {
      const endsAt = member.membershipEndsAt.toMillis();
      if (endsAt <= now) {
        status = 'denied';
        message = 'Geçiş reddedildi: Paket süresi bitmiş.';
        allowed = false;
      }
    }

    // 2. Log access attempt
    await this.logAccess({
      userId: member.uid,
      userName: member.displayName || 'İsimsiz Üye',
      userPhoto: member.photoURL,
      direction,
      method,
      status,
      gateName,
      notes: message,
    });

    return {
      allowed,
      status,
      message,
      userName: member.displayName || 'İsimsiz Üye',
      userPhoto: member.photoURL,
      gateName,
      timestamp: new Date(),
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

  /**
   * Taranan dinamik QR kodunu veya RFID token'ını doğrular, üyeyi bulur ve kapı geçişini işletir
   */
  async validateAndProcessDynamicQrToken(
    tokenRaw: string,
    direction: AccessDirection = 'in',
    gateName: string = 'Turnike Okuyucu',
  ): Promise<GateScanResult> {
    try {
      let payload: any;
      try {
        payload = JSON.parse(tokenRaw);
      } catch {
        payload = { uid: tokenRaw.trim() };
      }

      const uid = payload.uid;
      if (!uid) {
        throw new Error('Geçersiz QR kod veya kimlik bilgisi.');
      }

      // 30 saniyelik süresi geçmiş mi kontrolü (15 sn tolerans payı)
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

      // Veritabanından üye profilini çek
      const userDocRef = doc(this.firestore, 'users', uid);
      const snap = await getDoc(userDocRef);
      if (!snap.exists()) {
        return {
          allowed: false,
          status: 'denied',
          message: 'Üye kaydı sistemde bulunamadı.',
          userName: payload.name || 'Tanımsız Üye',
          gateName,
          timestamp: new Date(),
        };
      }

      const member = { uid: snap.id, ...snap.data() } as UserProfile;
      return await this.processGateScan(member, direction, gateName, 'qr');
    } catch (err: any) {
      return {
        allowed: false,
        status: 'denied',
        message: err.message || 'Geçiş okuma hatası meydana geldi.',
        userName: 'Tanımsız Kart',
        gateName,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Yerel Edge Ajanına (Perkotek YT-32 Servisi) anlık log çekme emri gönderir
   */
  async requestDeviceSync(): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId || this.auth.profile()?.uid;
    if (!tenantId) return;

    await addDoc(collection(this.firestore, 'device_commands'), {
      tenantId,
      command: 'PULL_LOGS_NOW',
      targetDevice: 'ALL_GATES',
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  }

  /**
   * Üyenin abonelik bitiş tarihi değiştiğinde Perkotek YT-32 cihazında
   * üyenin erişimini açmak veya engellemek için senkronizasyon kuyruğuna yazar
   */
  async queueMemberDeviceSync(
    userId: string,
    displayName: string,
    action: 'ENABLE' | 'DISABLE' | 'UPDATE_EXPIRY',
    endsAt?: Date,
    cardNo?: string,
  ): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId || this.auth.profile()?.uid;
    if (!tenantId) return;

    await addDoc(collection(this.firestore, 'device_sync_queue'), {
      tenantId,
      userId,
      displayName,
      cardNo: cardNo || null,
      action,
      expiresAt: endsAt ? Timestamp.fromDate(endsAt) : null,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  }
}
