import { Timestamp } from '@angular/fire/firestore';

export type AccessDirection = 'in' | 'out';
export type AccessMethod = 'qr' | 'rfid' | 'nfc' | 'manual';
export type AccessStatus = 'granted' | 'denied' | 'anti_passback_warning';

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
