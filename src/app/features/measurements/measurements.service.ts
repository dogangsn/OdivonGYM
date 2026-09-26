import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom, of } from 'rxjs';
import { HealthApi } from '../../core/api/health.api';
import { tenantReload } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import { BodyMeasurement, CreateBodyMeasurementInput } from '../../core/models/body-measurement.model';

@Injectable({ providedIn: 'root' })
export class MeasurementsService {
  private readonly api = inject(HealthApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  watchMeasurements(): Observable<BodyMeasurement[]> {
    return tenantReload(this.profile$, this.reload$, () => {
      const userId = this.auth.profile()?.uid;
      if (!userId) return of([]);
      return this.api.listMeasurements({ userId });
    });
  }

  async addMeasurement(input: CreateBodyMeasurementInput): Promise<string> {
    const created = await firstValueFrom(
      this.api.createMeasurement({
        ...input,
        date: input.date instanceof Date ? input.date.toISOString() : input.date,
      }),
    );
    this.reload$.next();
    return created.id;
  }

  async updateMeasurement(id: string, input: Partial<CreateBodyMeasurementInput>): Promise<void> {
    await firstValueFrom(
      this.api.updateMeasurement(id, {
        ...input,
        date: input.date instanceof Date ? input.date.toISOString() : input.date,
      }),
    );
    this.reload$.next();
  }

  async deleteMeasurement(id: string): Promise<void> {
    await firstValueFrom(this.api.removeMeasurement(id));
    this.reload$.next();
  }
}
