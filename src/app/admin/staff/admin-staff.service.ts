import { Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
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
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { StaffMember, StaffStatus } from '../../core/models/staff.model';
import { UserRole } from '../../core/models/user-role.model';
import { BranchContextService } from '../../core/services/branch-context.service';

@Injectable({ providedIn: 'root' })
export class AdminStaffService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly branchContext = inject(BranchContextService);
  private readonly profile$ = toObservable(this.auth.profile);

  // Local reactive cache for staff
  readonly localStaff = signal<StaffMember[]>([]);

  private seedingTriggered = false;

  watchStaff(): Observable<StaffMember[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) {
          return of(this.localStaff());
        }

        const q = query(
          collection(this.firestore, 'gym_staff'),
          where('tenantId', '==', tenantId),
        );

        return (collectionData(q, { idField: 'id' }) as Observable<StaffMember[]>).pipe(
          catchError(() => of([] as StaffMember[])),
          map((list) => {
            if (list.length === 0) {
              if (!this.seedingTriggered) {
                this.seedingTriggered = true;
                void this.seedInitialStaff(tenantId);
              }
              return this.localStaff();
            }

            // Sync to local signal
            this.localStaff.set(list);


            return [...list].sort((a, b) => {
              const roleOrder: Record<UserRole, number> = {
                owner: 1,
                admin: 2,
                trainer: 3,
                receptionist: 4,
                user: 5,
              };
              const orderA = roleOrder[a.role] ?? 99;
              const orderB = roleOrder[b.role] ?? 99;
              if (orderA !== orderB) return orderA - orderB;
              return a.displayName.localeCompare(b.displayName);
            });
          }),
        );
      }),
    );
  }

  async createStaff(input: Partial<StaffMember>): Promise<string> {
    const profile = this.auth.profile();
    const tenantId = profile?.tenantId || 'default-tenant';
    const activeBranch = this.branchContext.activeBranch();

    const newStaff: StaffMember = {
      id: `staff-${Date.now()}`,
      tenantId,
      displayName: input.displayName?.trim() || '',
      email: input.email?.trim().toLowerCase() || '',
      phone: input.phone?.trim() || '',
      role: input.role || 'trainer',
      title: input.title?.trim() || 'Kulüp Personeli',
      branchId: input.branchId || activeBranch?.id || null,
      branchName: input.branchName || activeBranch?.name || 'Kadıköy Merkez Şube',
      specialties: input.specialties || [],
      customPermissions: input.customPermissions || [],
      status: input.status || 'active',
      hireDate: input.hireDate || new Date().toISOString().slice(0, 10),
      emergencyContact: input.emergencyContact?.trim() || '',
      monthlySalary: Number(input.monthlySalary) || 0,
      commissionRate: Number(input.commissionRate) || 0,
      notes: input.notes?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update local cache
    this.localStaff.update((curr) => [newStaff, ...curr]);

    // Save to Firestore if tenant exists
    try {
      if (tenantId && tenantId !== 'default-tenant') {
        const docRef = await addDoc(collection(this.firestore, 'gym_staff'), {
          ...newStaff,
          createdAtTimestamp: serverTimestamp(),
          updatedAtTimestamp: serverTimestamp(),
        });
        return docRef.id;
      }
    } catch (err) {
      console.warn('Firestore personel ekleme arka planda ertelendi:', err);
    }

    return newStaff.id;
  }

  async updateStaff(id: string, input: Partial<StaffMember>): Promise<void> {
    // Update local cache
    this.localStaff.update((curr) =>
      curr.map((s) => (s.id === id ? { ...s, ...input, updatedAt: new Date().toISOString() } : s)),
    );

    try {
      const docRef = doc(this.firestore, `gym_staff/${id}`);
      const updateData: Record<string, unknown> = {
        ...input,
        updatedAt: new Date().toISOString(),
        updatedAtTimestamp: serverTimestamp(),
      };
      delete updateData['id'];
      await updateDoc(docRef, updateData);
    } catch (err) {
      console.warn('Firestore personel güncelleme arka planda ertelendi:', err);
    }
  }

  async deleteStaff(id: string): Promise<void> {
    // Update local cache
    this.localStaff.update((curr) => curr.filter((s) => s.id !== id));

    try {
      await deleteDoc(doc(this.firestore, `gym_staff/${id}`));
    } catch (err) {
      console.warn('Firestore personel silme arka planda ertelendi:', err);
    }
  }

  async toggleStatus(id: string, currentStatus: StaffStatus): Promise<void> {
    const nextStatus: StaffStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await this.updateStaff(id, { status: nextStatus });
  }

  private async seedInitialStaff(tenantId: string): Promise<void> {
    try {
      const user = this.auth.profile();
      if (!user) return;
      const activeBranch = this.branchContext.activeBranch();
      const colRef = collection(this.firestore, 'gym_staff');
      const newDoc = doc(colRef);
      const now = new Date().toISOString();

      const initialAdmin: StaffMember = {
        id: newDoc.id,
        tenantId,
        displayName: user.displayName || 'SüperAdmin / Kurucu',
        email: user.email || '',
        phone: user.phone || '',
        role: 'owner',
        title: 'Salon Sahibi / Kurucu (SüperAdmin)',
        status: 'active',
        specialties: ['Genel Yönetim', 'İşletme'],
        hireDate: now.slice(0, 10),
        emergencyContact: '',
        monthlySalary: 0,
        commissionRate: 0,
        notes: 'Sisteme ilk kaydolan kurucu SüperAdmin.',
        branchId: activeBranch?.id || null,
        branchName: activeBranch?.name || 'Merkez Şube',
        customPermissions: [],
        createdAt: now,
        updatedAt: now,
      };

      await addDoc(colRef, {
        ...initialAdmin,
        createdAtTimestamp: serverTimestamp(),
        updatedAtTimestamp: serverTimestamp(),
      });

      this.localStaff.set([initialAdmin]);
    } catch (err) {
      console.warn('Otomatik SüperAdmin kaydı atlandı veya başarısız:', err);
    }
  }

}
