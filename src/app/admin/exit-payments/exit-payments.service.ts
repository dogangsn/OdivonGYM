import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { ExitPaymentApi } from '../../core/api/exit-payment.api';
import { tenantReload } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import {
  CollectExitPaymentInput,
  CreateExitPaymentInput,
  ExitPayment,
} from '../../core/models/exit-payment.model';

@Injectable({ providedIn: 'root' })
export class ExitPaymentsService {
  private readonly api = inject(ExitPaymentApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  watchExitPayments(status?: string): Observable<ExitPayment[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.list(status));
  }

  async createExitPayment(input: CreateExitPaymentInput): Promise<ExitPayment> {
    const created = await firstValueFrom(this.api.create(input));
    this.reload$.next();
    return created;
  }

  async collectExitPayment(id: string, input: CollectExitPaymentInput): Promise<void> {
    await firstValueFrom(this.api.collect(id, input));
    this.reload$.next();
  }

  async cancelExitPayment(id: string): Promise<void> {
    await firstValueFrom(this.api.cancel(id));
    this.reload$.next();
  }

  async updateExitPayment(id: string, input: Partial<CreateExitPaymentInput>): Promise<void> {
    await firstValueFrom(this.api.update(id, input));
    this.reload$.next();
  }

  async removeExitPayment(id: string): Promise<void> {
    await firstValueFrom(this.api.remove(id));
    this.reload$.next();
  }

  refresh(): void {
    this.reload$.next();
  }
}
