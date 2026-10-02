import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom, of } from 'rxjs';
import { HealthApi } from '../../core/api/health.api';
import { MemberApi } from '../../core/api/member.api';
import { tenantReload } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import { BodyMeasurement, CreateBodyMeasurementInput } from '../../core/models/body-measurement.model';

@Injectable({ providedIn: 'root' })
export class MeasurementsService {
  private readonly api = inject(HealthApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();
  private readonly member = inject(MemberApi);

  /** Üye hesabı personel uçlarından 403 alır; kendi ölçümlerini /gym/mobile/* ile yönetir. */
  isMember(): boolean {
    return this.auth.profile()?.role === 'user';
  }

  watchMeasurements(): Observable<BodyMeasurement[]> {
    return tenantReload(this.profile$, this.reload$, () => {
      const userId = this.auth.profile()?.uid;
      if (!userId) return of([]);
      if (this.isMember()) return this.member.measurements();
      return this.api.listMeasurements({ userId });
    });
  }

  async addMeasurement(input: CreateBodyMeasurementInput): Promise<string> {
    const body = { ...input, date: input.date instanceof Date ? input.date.toISOString() : input.date };
    const created = await firstValueFrom(
      this.isMember() ? this.member.createMeasurement(body) : this.api.createMeasurement(body),
    );
    this.reload$.next();
    return created.id;
  }

  async updateMeasurement(id: string, input: Partial<CreateBodyMeasurementInput>): Promise<void> {
    const body = { ...input, date: input.date instanceof Date ? input.date.toISOString() : input.date };
    await firstValueFrom(this.isMember() ? this.member.updateMeasurement(id, body) : this.api.updateMeasurement(id, body));
    this.reload$.next();
  }

  async deleteMeasurement(id: string): Promise<void> {
    await firstValueFrom(this.isMember() ? this.member.removeMeasurement(id) : this.api.removeMeasurement(id));
    this.reload$.next();
  }
}
