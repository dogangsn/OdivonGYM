import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import {
  ConsentText,
  MemberConsentResponse,
  RecordMemberConsentsInput,
  RevokeConsentInput,
} from '../models/consent.model';

@Injectable({ providedIn: 'root' })
export class ConsentApi {
  private readonly api = inject(ApiClient);

  /**
   * Aktif KVKK aydınlatma ve açık rıza metin şablonlarını getirir.
   */
  getActiveTexts() {
    return this.api.get<ConsentText[]>('/gym/consents/texts').pipe(map((r) => r.data ?? []));
  }

  /**
   * Tenant yöneticisi için rıza metni versiyonu kaydetme/güncelleme.
   */
  upsertText(body: Partial<ConsentText>) {
    return this.api.post<ConsentText>('/gym/consents/texts', body).pipe(map((r) => r.data));
  }

  /**
   * Belirli bir üyenin açık rıza özetini ve tüm log geçmişini getirir.
   */
  getMemberConsents(memberId: string) {
    return this.api
      .get<MemberConsentResponse>(`/gym/consents/members/${memberId}`)
      .pipe(map((r) => r.data));
  }

  /**
   * Üyenin rıza tercihlerini ispat günlüğüne mühürler.
   */
  recordConsents(body: RecordMemberConsentsInput) {
    return this.api.post<{ success: boolean; recordedCount: number }>('/gym/consents/record', body).pipe(
      map((r) => r.data),
    );
  }

  /**
   * Üyenin rızasını geri çeker (opt-out).
   */
  revokeConsent(body: RevokeConsentInput) {
    return this.api.post<{ success: boolean; revoked: string }>('/gym/consents/revoke', body).pipe(
      map((r) => r.data),
    );
  }
}
