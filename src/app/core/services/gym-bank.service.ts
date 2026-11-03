import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { AccountingApi } from '../api/accounting.api';
import { tenantReload } from '../api/unwrap';
import { AuthService } from '../auth/auth.service';
import { CreateGymBankInput, GymBank } from '../models/gym-bank.model';
import { DailyCloseReminderSettings, UpdateDailyCloseReminderSettingsDto } from '../models/daily-close.model';

@Injectable({ providedIn: 'root' })
export class GymBankService {
  private readonly api = inject(AccountingApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  watchBanks(): Observable<GymBank[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.listBanks());
  }

  async addBank(input: CreateGymBankInput): Promise<GymBank> {
    const created = await firstValueFrom(this.api.createBank(input));
    this.reload$.next();
    return created;
  }

  async updateBank(id: string, input: Partial<CreateGymBankInput>): Promise<GymBank> {
    const updated = await firstValueFrom(this.api.updateBank(id, input));
    this.reload$.next();
    return updated;
  }

  async setDefaultPos(id: string): Promise<void> {
    const currentBanks = await firstValueFrom(this.watchBanks());
    for (const b of currentBanks) {
      if (b.id === id) {
        if (!b.isDefaultPos) {
          await firstValueFrom(this.api.updateBank(b.id, { isDefaultPos: true }));
        }
      } else if (b.isDefaultPos) {
        await firstValueFrom(this.api.updateBank(b.id, { isDefaultPos: false }));
      }
    }
    this.reload$.next();
  }

  async seedPopularBanks(): Promise<void> {
    // List banks first, backend seeds automatically if empty, or we trigger reload
    await firstValueFrom(this.api.listBanks());
    this.reload$.next();
  }

  async deleteBank(id: string): Promise<void> {
    await firstValueFrom(this.api.deleteBank(id));
    this.reload$.next();
  }

  async getReminderSettings(): Promise<DailyCloseReminderSettings> {
    return firstValueFrom(this.api.getDailyCloseReminderSettings());
  }

  async updateReminderSettings(dto: UpdateDailyCloseReminderSettingsDto): Promise<DailyCloseReminderSettings> {
    return firstValueFrom(this.api.updateDailyCloseReminderSettings(dto));
  }
}
