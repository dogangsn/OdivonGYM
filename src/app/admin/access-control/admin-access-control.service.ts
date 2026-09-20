import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  query,
  where,
  addDoc,
  serverTimestamp,
  Timestamp,
} from '@angular/fire/firestore';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { UserProfile } from '../../core/models/user-profile.model';
import {
  AccessDirection,
  AccessLog,
  AccessMethod,
  AccessStatus,
  CreateAccessLogInput,
} from '../../core/models/access-log.model';

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

  watchLogs(): Observable<AccessLog[]> {
    return toObservable(this.auth.profile).pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;

        if (!tenantId) {
          return of([] as AccessLog[]);
        }

        const q = query(
          collection(this.firestore, 'access_logs'),
          where('tenantId', '==', tenantId),
        );

        return collectionData(q, { idField: 'id' }) as Observable<AccessLog[]>;
      }),
    );
  }

  async logAccess(input: CreateAccessLogInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;

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
}
