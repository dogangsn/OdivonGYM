import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, combineLatest, firstValueFrom, startWith, switchMap } from 'rxjs';
import { SmsApi, SmsGatewayConfig, SmsBalanceResult, SmsSendResult } from '../../core/api/sms.api';
import { AuthService } from '../../core/auth/auth.service';

@Injectable({ providedIn: 'root' })
export class AdminSmsSettingsService {
  private readonly api = inject(SmsApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  watchConfig(): Observable<SmsGatewayConfig> {
    return combineLatest([this.profile$, this.reload$.pipe(startWith(undefined))]).pipe(
      switchMap(() => this.api.getConfig()),
    );
  }

  async saveConfig(config: Partial<SmsGatewayConfig>): Promise<SmsGatewayConfig> {
    const res = await firstValueFrom(this.api.saveConfig(config));
    this.reload$.next();
    return res;
  }

  async queryBalance(): Promise<SmsBalanceResult> {
    const res = await firstValueFrom(this.api.getBalance());
    this.reload$.next();
    return res;
  }

  async sendTestSms(phone: string, message?: string, header?: string): Promise<SmsSendResult> {
    const res = await firstValueFrom(this.api.sendTest({ phone, message, header }));
    this.reload$.next();
    return res;
  }

  async sendBatch(recipients: string[], message: string, header?: string): Promise<SmsSendResult> {
    return firstValueFrom(this.api.send({ recipients, message, header }));
  }
}
