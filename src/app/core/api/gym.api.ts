import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { GymBranch } from '../models/gym-branch.model';
import { GymInfo } from '../models/gym-info.model';
import { GymPackage } from '../models/gym-package.model';
import { StaffMember } from '../models/staff.model';
import { UserProfile } from '../models/user-profile.model';
import { ApiClient } from '../http/api-client';
import { unwrapList } from './unwrap';

@Injectable({ providedIn: 'root' })
export class GymApi {
  private readonly api = inject(ApiClient);

  listMembers(query?: Record<string, string | number | boolean | undefined>) {
    return this.api
      .get<UserProfile[]>('/gym/members', { limit: 100, ...query })
      .pipe(map((r) => unwrapList<UserProfile>(r.data).map((m) => asMember(m))));
  }

  createMember(body: unknown) {
    return this.api.post<UserProfile>('/gym/members', body).pipe(map((r) => asMember(r.data)));
  }

  updateMember(id: string, body: unknown) {
    return this.api.patch<UserProfile>(`/gym/members/${id}`, body).pipe(map((r) => asMember(r.data)));
  }

  deleteMember(id: string) {
    return this.api.delete<{ id: string }>(`/gym/members/${id}`).pipe(map((r) => r.data));
  }

  renewMember(id: string, body: unknown) {
    return this.api.post<UserProfile>(`/gym/members/${id}/renew`, body).pipe(map((r) => asMember(r.data)));
  }

  freezeMember(id: string, body: unknown) {
    return this.api.post<UserProfile>(`/gym/members/${id}/freeze`, body).pipe(map((r) => asMember(r.data)));
  }

  cancelMember(id: string, body: unknown) {
    return this.api.post<UserProfile>(`/gym/members/${id}/cancel`, body).pipe(map((r) => asMember(r.data)));
  }

  listPackages(activeOnly = false) {
    return this.api
      .get<GymPackage[]>('/gym/packages', {
        limit: 100,
        status: activeOnly ? 'active' : undefined,
      })
      .pipe(map((r) => unwrapList<GymPackage>(r.data)));
  }

  createPackage(body: unknown) {
    return this.api.post<GymPackage>('/gym/packages', body).pipe(map((r) => r.data));
  }

  updatePackage(id: string, body: unknown) {
    return this.api.patch<GymPackage>(`/gym/packages/${id}`, body).pipe(map((r) => r.data));
  }

  deletePackage(id: string) {
    return this.api.delete<{ id: string }>(`/gym/packages/${id}`).pipe(map((r) => r.data));
  }

  listBranches() {
    return this.api.get<GymBranch[]>('/gym/branches', { limit: 100 }).pipe(map((r) => unwrapList<GymBranch>(r.data)));
  }

  createBranch(body: unknown) {
    return this.api.post<GymBranch>('/gym/branches', body).pipe(map((r) => r.data));
  }

  updateBranch(id: string, body: unknown) {
    return this.api.patch<GymBranch>(`/gym/branches/${id}`, body).pipe(map((r) => r.data));
  }

  deleteBranch(id: string) {
    return this.api.delete<{ id: string }>(`/gym/branches/${id}`).pipe(map((r) => r.data));
  }

  listStaff() {
    return this.api.get<StaffMember[]>('/gym/staff', { limit: 100 }).pipe(map((r) => unwrapList<StaffMember>(r.data)));
  }

  createStaff(body: unknown) {
    return this.api.post<StaffMember>('/gym/staff', body).pipe(map((r) => r.data));
  }

  updateStaff(id: string, body: unknown) {
    return this.api.patch<StaffMember>(`/gym/staff/${id}`, body).pipe(map((r) => r.data));
  }

  deleteStaff(id: string) {
    return this.api.delete<{ id: string }>(`/gym/staff/${id}`).pipe(map((r) => r.data));
  }

  getInfo() {
    return this.api.get<GymInfo | null>('/gym/info').pipe(map((r) => r.data));
  }

  patchInfo(body: unknown) {
    return this.api.patch<GymInfo>('/gym/info', body).pipe(map((r) => r.data));
  }

  seedDefaults() {
    return this.api.post('/gym/onboarding/defaults', {}).pipe(map((r) => r.data));
  }

  completeOnboarding(body: unknown) {
    return this.api.post('/gym/onboarding/complete', body).pipe(map((r) => r.data));
  }
}

export { unwrapList } from './unwrap';

function asMember(member: UserProfile | (UserProfile & { id?: string }) | null | undefined): UserProfile {
  if (!member) {
    return member as unknown as UserProfile;
  }
  const id = member.uid || (member as { id?: string }).id || '';
  return {
    ...member,
    uid: id,
    role: member.role || 'user',
  };
}
