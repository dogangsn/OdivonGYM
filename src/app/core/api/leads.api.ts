import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { GuestMember, LeadStage } from '../models/guest-member.model';

export interface FunnelGroup {
  key: string;
  leads: number;
  converted: number;
  conversionRate: number;
}

export interface LeadFunnel {
  from: string | null;
  to: string | null;
  total: number;
  converted: number;
  lost: number;
  open: number;
  conversionRate: number;
  avgDaysToConvert: number | null;
  overdueFollowUps: number;
  stages: { stage: LeadStage; current: number; reached: number; rate: number }[];
  bySource: FunnelGroup[];
  byStaff: FunnelGroup[];
  lostReasons: { reason: string; count: number }[];
  referrals: number;
}

export interface ReferralSettings {
  enabled: boolean;
  rewardType: 'wallet' | 'days';
  /** TL */
  rewardAmount: number;
  rewardDays: number;
}

export interface ReferralReward {
  id: string;
  referrerMemberId: string;
  referrerName: string;
  referredMemberId: string;
  referredName: string;
  leadId: string | null;
  type: 'wallet' | 'days';
  amount: number | null;
  days: number | null;
  status: 'granted' | 'pending';
  note: string | null;
  createdAt: string;
}

export interface ReferralSummary {
  items: ReferralReward[];
  referrers: { referrerMemberId: string; referrerName: string; referrals: number; walletTotal: number; days: number }[];
}

export interface ConvertResult {
  leadId: string;
  memberId: string;
  referrerMemberId: string | null;
  reward: ReferralReward | null;
}

@Injectable({ providedIn: 'root' })
export class LeadsApi {
  private readonly api = inject(ApiClient);

  funnel(query: { from?: string; to?: string; branchId?: string }) {
    return this.api.get<LeadFunnel>('/gym/leads/funnel', query).pipe(map((r) => r.data));
  }

  stage(id: string, stage: LeadStage, lostReason?: string) {
    return this.api.post<GuestMember>(`/gym/leads/${id}/stage`, { stage, lostReason }).pipe(map((r) => r.data));
  }

  convert(id: string, memberId: string) {
    return this.api.post<ConvertResult>(`/gym/leads/${id}/convert`, { memberId }).pipe(map((r) => r.data));
  }

  referrals() {
    return this.api.get<ReferralSummary>('/gym/referrals').pipe(map((r) => r.data));
  }

  recordReferral(referrerMemberId: string, memberId: string) {
    return this.api.post<ConvertResult>('/gym/referrals', { referrerMemberId, memberId }).pipe(map((r) => r.data));
  }

  referralSettings() {
    return this.api.get<ReferralSettings>('/gym/referrals/settings').pipe(map((r) => r.data));
  }

  saveReferralSettings(body: Partial<ReferralSettings>) {
    return this.api.patch<ReferralSettings>('/gym/referrals/settings', body).pipe(map((r) => r.data));
  }
}
