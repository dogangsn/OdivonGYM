import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom, of } from 'rxjs';
import { HealthApi } from '../../core/api/health.api';
import { tenantReload } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import { CreateWaterLogInput, WaterLog } from '../../core/models/water-log.model';

@Injectable({ providedIn: 'root' })
export class WaterService {
  private readonly api = inject(HealthApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  watchLogs(): Observable<WaterLog[]> {
    return tenantReload(this.profile$, this.reload$, () => {
      const userId = this.auth.profile()?.uid;
      if (!userId) return of([]);
      return this.api.listWater({ userId });
    });
  }

  async addLog(input: CreateWaterLogInput): Promise<string> {
    const created = await firstValueFrom(
      this.api.createWater({
        ...input,
        date: input.date.toISOString(),
      }),
    );
    this.reload$.next();
    return created.id;
  }

  async updateLog(id: string, input: Partial<CreateWaterLogInput>): Promise<void> {
    await firstValueFrom(
      this.api.updateWater(id, {
        ...input,
        date: input.date ? input.date.toISOString() : undefined,
      }),
    );
    this.reload$.next();
  }

  async deleteLog(id: string): Promise<void> {
    await firstValueFrom(this.api.removeWater(id));
    this.reload$.next();
  }
}
