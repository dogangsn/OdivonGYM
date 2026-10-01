import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { GuestsApi } from '../../core/api/guests.api';
import { tenantReload } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import { CreateGuestMemberInput, GuestMember, UpdateGuestMemberInput } from '../../core/models/guest-member.model';

@Injectable({ providedIn: 'root' })
export class AdminGuestMembersService {
  private readonly api = inject(GuestsApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  watchGuestMembers(): Observable<GuestMember[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.list());
  }

  async addGuestMember(input: CreateGuestMemberInput): Promise<string> {
    const created = await firstValueFrom(
      this.api.create({
        ...input,
        followUpDate: input.followUpDate ? input.followUpDate.toISOString() : null,
      }),
    );
    this.reload$.next();
    return created.id;
  }

  async updateGuestMember(id: string, input: UpdateGuestMemberInput): Promise<void> {
    await firstValueFrom(
      this.api.update(id, {
        ...input,
        followUpDate:
          input.followUpDate instanceof Date ? input.followUpDate.toISOString() : input.followUpDate,
      }),
    );
    this.reload$.next();
  }

  reload(): void {
    this.reload$.next();
  }

  async deleteGuestMember(id: string): Promise<void> {
    await firstValueFrom(this.api.remove(id));
    this.reload$.next();
  }
}
