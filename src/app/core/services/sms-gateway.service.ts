import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom, of, startWith, switchMap } from 'rxjs';
import { SmsApi, SmsGatewayConfig, SmsSendResult } from '../api/sms.api';
import { AuthService } from '../auth/auth.service';

export type { SmsProviderType, SmsGatewayConfig, SmsSendResult } from '../api/sms.api';

export interface SmsSendInput {
  recipients: string[];
  message: string;
  title?: string;
}

@Injectable({ providedIn: 'root' })
export class SmsGatewayService {
  private readonly api = inject(SmsApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  watchConfig(): Observable<SmsGatewayConfig | null> {
    return this.profile$.pipe(
      switchMap((profile) => {
        if (!profile?.tenantId) return of(null);
        return this.reload$.pipe(
          startWith(null),
          switchMap(() => this.api.getConfig()),
        );
      }),
    );
  }

  async saveConfig(input: Partial<SmsGatewayConfig>): Promise<void> {
    await firstValueFrom(this.api.saveConfig(input));
    this.reload$.next();
  }

  async sendBulkSms(input: SmsSendInput): Promise<SmsSendResult> {
    return firstValueFrom(
      this.api.send({
        recipients: input.recipients,
        message: input.message,
        title: input.title,
      }),
    );
  }
}
