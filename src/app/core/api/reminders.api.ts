import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { unwrapList } from './unwrap';

export type ReminderType = 'membership_expiring' | 'installment_overdue' | 'inactive_member';

export interface ReminderTemplate {
  title: string;
  body: string;
}

export interface ReminderSettings {
  enabled: boolean;
  smsEnabled: boolean;
  expiryDays: number[];
  overdueDays: number[];
  inactiveDays: number;
  templates: Record<ReminderType, ReminderTemplate>;
}

export interface GymReminder {
  id: string;
  type: ReminderType;
  userId: string;
  memberName: string;
  phone: string | null;
  milestone: number;
  day: string;
  title: string;
  body: string;
  sms: 'disabled' | 'no_phone' | 'sent' | 'failed';
  createdAt: string;
}

export interface ReminderRunResult {
  day: string;
  dryRun: boolean;
  enabled: boolean;
  candidates: number;
  created: number;
  skippedExisting: number;
  byType: Record<ReminderType, number>;
  preview?: { type: ReminderType; userId: string; memberName: string; title: string; body: string }[];
}

@Injectable({ providedIn: 'root' })
export class RemindersApi {
  private readonly api = inject(ApiClient);

  list(day?: string) {
    return this.api.get<GymReminder[]>('/gym/reminders', { day }).pipe(map((r) => unwrapList<GymReminder>(r.data)));
  }

  settings() {
    return this.api.get<ReminderSettings>('/gym/reminders/settings').pipe(map((r) => r.data));
  }

  saveSettings(body: Partial<ReminderSettings>) {
    return this.api.patch<ReminderSettings>('/gym/reminders/settings', body).pipe(map((r) => r.data));
  }

  run(dryRun: boolean) {
    return this.api.post<ReminderRunResult>('/gym/reminders/run', { dryRun }).pipe(map((r) => r.data));
  }
}
