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

const INITIAL_STAFF_SEEDS = [
  {
    id: 'staff-1',
    displayName: 'Ahmet Hakan Özdemir',
    email: 'ahmet.ozdemir@odivongym.com',
    phone: '+90 532 100 20 30',
    role: 'owner' as UserRole,
    title: 'Salon Sahibi / Kurucu Ortak',
    status: 'active' as StaffStatus,
    specialties: ['İşletme & Finans', 'Salon Yönetimi'],
    hireDate: '2024-01-01',
    emergencyContact: '+90 532 999 88 77 (Eşi)',
    monthlySalary: 0,
    commissionRate: 0,
    notes: 'OdivonGYM tüm şubeler ve lisans yetkilisi.',
    branchName: 'Kadıköy Merkez Şube',
    createdAt: '2024-01-01T08:00:00.000Z',
  },
  {
    id: 'staff-2',
    displayName: 'Burak Can Yılmaz',
    email: 'burak.yilmaz@odivongym.com',
    phone: '+90 533 210 30 40',
    role: 'admin' as UserRole,
    title: 'Genel Yönetici / Kulüp Müdürü',
    status: 'active' as StaffStatus,
    specialties: ['Operasyon', 'Personel & Turnike Yönetimi'],
    hireDate: '2024-03-15',
    emergencyContact: '+90 533 111 22 33',
    monthlySalary: 65000,
    commissionRate: 5,
    notes: 'Günlük salon akışı ve vardiya sorumlusu.',
    branchName: 'Kadıköy Merkez Şube',
    createdAt: '2024-03-15T09:00:00.000Z',
  },
  {
    id: 'staff-3',
    displayName: 'Mert Demir',
    email: 'mert.demir@odivongym.com',
    phone: '+90 535 320 40 50',
    role: 'trainer' as UserRole,
    title: 'Baş Antrenör (PT & Dövüş Sanatları)',
    status: 'active' as StaffStatus,
    specialties: ['Fitness & Bodybuilding', 'Kickbox', 'Kuvvet Antrenmanı'],
    hireDate: '2024-06-01',
    emergencyContact: '+90 535 444 55 66',
    monthlySalary: 45000,
    commissionRate: 20,
    notes: 'Kadıköy Merkez Şube baş antrenörü, milli sporcu.',
    branchName: 'Kadıköy Merkez Şube',
    createdAt: '2024-06-01T10:00:00.000Z',
  },
  {
    id: 'staff-4',
    displayName: 'Elif Yıldız Kaya',
    email: 'elif.yildiz@odivongym.com',
    phone: '+90 536 430 50 60',
    role: 'trainer' as UserRole,
    title: 'Kıdemli PT & Pilates Eğitmeni',
    status: 'active' as StaffStatus,
    specialties: ['Reformer Pilates', 'Fonksiyonel Antrenman', 'Postür & Esneklik'],
    hireDate: '2024-07-15',
    emergencyContact: '+90 536 777 88 99',
    monthlySalary: 42000,
    commissionRate: 20,
    notes: 'Kadınlara özel grup dersleri ve birebir reformer sorumlusu.',
    branchName: 'Kadıköy Merkez Şube',
    createdAt: '2024-07-15T10:30:00.000Z',
  },
  {
    id: 'staff-5',
    displayName: 'Gizem Aksoy',
    email: 'gizem.aksoy@odivongym.com',
    phone: '+90 537 540 60 70',
    role: 'receptionist' as UserRole,
    title: 'Müşteri Hizmetleri & Resepsiyon Sorumlusu',
    status: 'active' as StaffStatus,
    specialties: ['Üye Karşılama', 'Kasa & POS', 'Vitamin Bar'],
    hireDate: '2024-09-01',
    emergencyContact: '+90 537 333 44 55',
    monthlySalary: 32000,
    commissionRate: 3,
    notes: 'Giriş turnike kontrolü, market satışları ve üye kayıtları.',
    branchName: 'Kadıköy Merkez Şube',
    createdAt: '2024-09-01T08:30:00.000Z',
  },
];

@Injectable({ providedIn: 'root' })
export class AdminStaffService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly branchContext = inject(BranchContextService);
  private readonly profile$ = toObservable(this.auth.profile);

  // Local reactive cache for instant offline/demo resilience
  readonly localStaff = signal<StaffMember[]>(
    INITIAL_STAFF_SEEDS.map((s) => ({
      ...s,
      tenantId: 'default-tenant',
      customPermissions: [],
    })),
  );

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
      const activeBranch = this.branchContext.activeBranch();
      const batch = writeBatch(this.firestore);
      const colRef = collection(this.firestore, 'gym_staff');

      for (const item of INITIAL_STAFF_SEEDS) {
        const newDoc = doc(colRef);
        batch.set(newDoc, {
          ...item,
          id: newDoc.id,
          tenantId,
          branchId: activeBranch?.id || null,
          branchName: activeBranch?.name || 'Kadıköy Merkez Şube',
          customPermissions: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdAtTimestamp: serverTimestamp(),
        });
      }

      await batch.commit();
    } catch (err) {
      console.warn('Otomatik personel tohumlama atlandı veya başarısız:', err);
    }
  }
}
