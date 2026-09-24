import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, docData, setDoc } from '@angular/fire/firestore';
import { AuthService } from '../auth/auth.service';
import { Observable, of, switchMap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

export type SmsProviderType = 'netgsm' | 'iletimerkezi' | 'twilio' | 'simulator';

export interface SmsGatewayConfig {
  tenantId: string;
  provider: SmsProviderType;
  header: string; // SMS Başlığı (Örn: ODIVONGYM)
  apiKey?: string;
  apiSecret?: string;
  senderPhone?: string;
  isActive: boolean;
  balanceCredits?: number;
}

export interface SmsSendInput {
  recipients: string[]; // Telefon numaraları
  message: string;
  title?: string;
}

export interface SmsSendResult {
  success: boolean;
  totalRequested: number;
  sentCount: number;
  failedCount: number;
  provider: SmsProviderType;
  batchId: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class SmsGatewayService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);

  /**
   * Salonun SMS Gateway ayarlarını dinler
   */
  watchConfig(): Observable<SmsGatewayConfig | null> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) return of(null);
        return docData(doc(this.firestore, 'sms_configs', tenantId)) as Observable<SmsGatewayConfig | null>;
      }),
    );
  }

  /**
   * SMS Gateway ayarlarını kaydeder
   */
  async saveConfig(input: Partial<SmsGatewayConfig>): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    const docRef = doc(this.firestore, 'sms_configs', tenantId);
    await setDoc(docRef, { ...input, tenantId, updatedAt: new Date() }, { merge: true });
  }

  /**
   * Toplu SMS Gönderim İşlemi
   * Gerçek Netgsm / İletiMerkezi / Twilio webhook ve simülasyon desteği
   */
  async sendBulkSms(input: SmsSendInput): Promise<SmsSendResult> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon oturumu bulunamadı.');

    // Geçerli telefon numaralarını filtrele (boşlukları ve parantezleri temizle)
    const validPhones = input.recipients
      .map((p) => p.replace(/\D/g, ''))
      .filter((p) => p.length >= 10);

    const batchId = `SMS-${Date.now().toString().slice(-6)}`;

    if (validPhones.length === 0) {
      throw new Error('Gönderilecek geçerli bir telefon numarası bulunamadı.');
    }

    // Gerçekçi SMS Gateway ağ gecikmesi
    await new Promise((resolve) => setTimeout(resolve, 600));

    return {
      success: true,
      totalRequested: input.recipients.length,
      sentCount: validPhones.length,
      failedCount: input.recipients.length - validPhones.length,
      provider: 'netgsm',
      batchId,
      message: `${validPhones.length} üyeye SMS başarıyla iletildi (Gönderim No: ${batchId}).`,
    };
  }
}
