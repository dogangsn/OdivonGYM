import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';

export interface CurrentUser {
  uid: string;
  email: string;
  displayName: string | null;
  phone: string | null;
  tenantId: string;
  role: 'owner' | 'admin' | 'user';
  accountType?: 'gym_member' | 'staff' | null;
  modules: string[];
  roleIds: string[];
  membershipStatus: 'trial' | 'active' | 'expired' | 'cancelled';
  trialEndsAt: string | null;
  onboardingCompleted: boolean;
  permissions: Record<string, string[]>;
  tenant: {
    id: string;
    name: string;
    status: string;
    onboardingCompleted: boolean;
    membershipStatus: string;
    trialEndsAt: string | null;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  tenantName: string;
  module: 'gym';
  displayName?: string;
  phone?: string;
}

@Injectable({ providedIn: 'root' })
export class IdentityApi {
  private readonly api = inject(ApiClient);

  register(body: RegisterRequest) {
    return this.api.post('/identity/register', body, { skipAuth: true }).pipe(map((r) => r.data));
  }

  me() {
    return this.api.get<CurrentUser>('/identity/me').pipe(map((r) => r.data));
  }

  updateMe(body: { displayName?: string; phone?: string }) {
    return this.api.patch<CurrentUser>('/identity/me', body).pipe(map((r) => r.data));
  }

  verifyEmail(token: string) {
    return this.api
      .post<{ success: boolean; email?: string }>(
        '/identity/verify-email',
        { token },
        { skipAuth: true },
      )
      .pipe(map((r) => r.data));
  }

  resendVerification(email: string) {
    return this.api
      .post<{ success: boolean }>(
        '/identity/resend-verification',
        { email },
        { skipAuth: true },
      )
      .pipe(map((r) => r.data));
  }

  changePassword(body: { currentPassword?: string; newPassword: string }) {
    return this.api
      .post<{ success: boolean; message: string }>('/identity/change-password', body)
      .pipe(map((r) => r.data));
  }
}

