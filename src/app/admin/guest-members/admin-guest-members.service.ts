import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
} from '@angular/fire/firestore';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { GuestMember, CreateGuestMemberInput, UpdateGuestMemberInput } from '../../core/models/guest-member.model';

@Injectable({ providedIn: 'root' })
export class AdminGuestMembersService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchGuestMembers(): Observable<GuestMember[]> {
    return toObservable(this.auth.profile).pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) {
          return of([] as GuestMember[]);
        }
        const q = query(
          collection(this.firestore, 'guest_members'),
          where('tenantId', '==', tenantId),
        );
        return collectionData(q, { idField: 'id' }) as Observable<GuestMember[]>;
      }),
    );
  }

  async addGuestMember(input: CreateGuestMemberInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');

    const docRef = await addDoc(collection(this.firestore, 'guest_members'), {
      tenantId,
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || '',
      gender: input.gender || 'unspecified',
      interestCategory: input.interestCategory || 'Genel Fitness',
      visitReason: input.visitReason || 'Salonu Gezme / Bilgi Alma',
      surveyNotes: input.surveyNotes?.trim() || '',
      budgetRange: input.budgetRange || '',
      status: input.status || 'visited',
      followUpDate: input.followUpDate ? Timestamp.fromDate(input.followUpDate) : null,
      assignedStaffName: input.assignedStaffName || '',
      branchId: input.branchId || null,
      branchName: input.branchName || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  async updateGuestMember(id: string, input: UpdateGuestMemberInput): Promise<void> {
    const updateData: any = { updatedAt: serverTimestamp() };

    if (input.fullName !== undefined) updateData.fullName = input.fullName.trim();
    if (input.phone !== undefined) updateData.phone = input.phone.trim();
    if (input.email !== undefined) updateData.email = input.email.trim();
    if (input.gender !== undefined) updateData.gender = input.gender;
    if (input.interestCategory !== undefined) updateData.interestCategory = input.interestCategory;
    if (input.visitReason !== undefined) updateData.visitReason = input.visitReason;
    if (input.surveyNotes !== undefined) updateData.surveyNotes = input.surveyNotes.trim();
    if (input.budgetRange !== undefined) updateData.budgetRange = input.budgetRange;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.followUpDate !== undefined) {
      updateData.followUpDate = input.followUpDate ? Timestamp.fromDate(input.followUpDate) : null;
    }
    if (input.assignedStaffName !== undefined) updateData.assignedStaffName = input.assignedStaffName;
    if (input.branchId !== undefined) updateData.branchId = input.branchId;
    if (input.branchName !== undefined) updateData.branchName = input.branchName;

    await updateDoc(doc(this.firestore, 'guest_members', id), updateData);
  }

  async deleteGuestMember(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'guest_members', id));
  }
}
