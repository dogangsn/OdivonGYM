import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom, of } from 'rxjs';
import { HealthApi } from '../../core/api/health.api';
import { MemberApi } from '../../core/api/member.api';
import { tenantReload } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import { CreateWaterLogInput, WaterLog } from '../../core/models/water-log.model';

@Injectable({ providedIn: 'root' })
export class WaterService {
  private readonly api = inject(HealthApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();
  private readonly member = inject(MemberApi);

  /** Üye hesabı personel uçlarından 403 alır; su kayıtlarını /gym/mobile/* ile yönetir. */
  isMember(): boolean {
    return this.auth.profile()?.role === 'user';
  }

  watchLogs(): Observable<WaterLog[]> {
    return tenantReload(this.profile$, this.reload$, () => {
      const userId = this.auth.profile()?.uid;
      if (!userId) return of([]);
      if (this.isMember()) return this.member.waterLogs();
      return this.api.listWater({ userId });
    });
  }

  async addLog(input: CreateWaterLogInput): Promise<string> {
    if (this.isMember()) {
      await firstValueFrom(
        this.member.addWater({ amountMl: toMl(input.amount, input.unit), date: input.date.toISOString(), notes: input.notes || undefined }),
      );
      this.reload$.next();
      return '';
    }
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
    if (this.isMember()) {
      await firstValueFrom(
        this.member.updateWater(id, {
          amountMl: input.amount !== undefined ? toMl(input.amount, input.unit ?? 'ml') : undefined,
          date: input.date ? input.date.toISOString() : undefined,
          notes: input.notes,
        }),
      );
      this.reload$.next();
      return;
    }
    await firstValueFrom(
      this.api.updateWater(id, {
        ...input,
        date: input.date ? input.date.toISOString() : undefined,
      }),
    );
    this.reload$.next();
  }

  async deleteLog(id: string): Promise<void> {
    await firstValueFrom(this.isMember() ? this.member.removeWater(id) : this.api.removeWater(id));
    this.reload$.next();
  }
}

/** Üye ucu mililitre saklar; bardak 250 ml, şişe 500 ml sayılır (su ekranındaki hesapla aynı). */
function toMl(amount: number, unit: CreateWaterLogInput['unit']): number {
  if (unit === 'liter') return Math.round(amount * 1000);
  if (unit === 'cup') return Math.round(amount * 250);
  if (unit === 'bottle') return Math.round(amount * 500);
  return Math.round(amount);
}
