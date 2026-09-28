import { Timestamp } from '@angular/fire/firestore';

export type AccessDirection = 'in' | 'out';
export type AccessMethod = 'qr' | 'rfid' | 'nfc' | 'manual';
/** `unknown`: cihaz geçiş sonucunu bildirmedi (agent ve sunucu tahmin etmez). */
export type AccessStatus = 'granted' | 'denied' | 'anti_passback_warning' | 'unknown';

export interface AccessLog {
  id: string;
  tenantId: string;
  userId?: string;
  userName: string;
  userPhoto?: string | null;
  direction: AccessDirection;
  method: AccessMethod;
  status: AccessStatus;
  gateName: string;
  notes?: string;
  timestamp: Timestamp;
  /** Agent'tan gelen cihaz olaylarında dolu. */
  gateId?: string;
  deviceUserId?: string | null;
  card?: string | null;
  source?: 'agent' | 'panel' | 'scan';
}

export interface CreateAccessLogInput {
  userId?: string;
  userName: string;
  userPhoto?: string | null;
  direction: AccessDirection;
  method: AccessMethod;
  status: AccessStatus;
  gateName: string;
  notes?: string;
}
