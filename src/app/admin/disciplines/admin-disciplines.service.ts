import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import {
  CreateSportsDisciplineInput,
  DEFAULT_DISCIPLINES_PRESETS,
  SportsDiscipline,
  UpdateSportsDisciplineInput,
} from '../../core/models/sports-discipline.model';
import {
  CreateGymEquipmentInput,
  CreateGymFacilityInput,
  DEFAULT_EQUIPMENT_PRESETS,
  GymEquipment,
  GymFacility,
  UpdateGymEquipmentInput,
  UpdateGymFacilityInput,
} from '../../core/models/gym-equipment.model';

@Injectable({ providedIn: 'root' })
export class AdminDisciplinesService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);

  // ==========================================
  // SPOR BRANŞLARI & DALLARI
  // ==========================================

  watchDisciplines(): Observable<SportsDiscipline[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) return of([] as SportsDiscipline[]);
        const q = query(
          collection(this.firestore, 'sports_disciplines'),
          where('tenantId', '==', tenantId),
        );
        return (collectionData(q, { idField: 'id' }) as Observable<SportsDiscipline[]>).pipe(
          map((list) =>
            [...list].sort(
              (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
            ),
          ),
        );
      }),
    );
  }

  async createDiscipline(input: CreateSportsDisciplineInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    const col = collection(this.firestore, 'sports_disciplines');
    const newDoc = doc(col);
    const now = serverTimestamp();

    await setDoc(newDoc, {
      id: newDoc.id,
      tenantId,
      name: input.name.trim(),
      code: input.code,
      category: input.category,
      description: input.description?.trim() || '',
      icon: input.icon || 'sports_martial_arts',
      colorTag: input.colorTag || 'indigo',
      requiredDocuments: input.requiredDocuments || [],
      supportedSessionTypes: input.supportedSessionTypes || ['group'],
      status: input.status || 'active',
      createdAt: now,
      updatedAt: now,
    });

    return newDoc.id;
  }

  async updateDiscipline(id: string, input: UpdateSportsDisciplineInput): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    await updateDoc(doc(this.firestore, 'sports_disciplines', id), {
      ...input,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteDiscipline(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'sports_disciplines', id));
  }

  /** Salon için varsayılan branşları toplu oluşturur (mükerrer kayıt engelli) */
  async seedDefaultDisciplines(): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    const q = query(
      collection(this.firestore, 'sports_disciplines'),
      where('tenantId', '==', tenantId),
    );
    const snap = await getDocs(q);
    const existingCodes = new Set(snap.docs.map((d) => d.data()['code']));
    const existingNames = new Set(snap.docs.map((d) => d.data()['name']?.toLowerCase()));

    const toAdd = DEFAULT_DISCIPLINES_PRESETS.filter(
      (preset) => !existingCodes.has(preset.code) && !existingNames.has(preset.name.toLowerCase()),
    );
    if (toAdd.length === 0) return;

    const batch = writeBatch(this.firestore);
    const now = serverTimestamp();

    for (const preset of toAdd) {
      const newDoc = doc(collection(this.firestore, 'sports_disciplines'));
      batch.set(newDoc, {
        id: newDoc.id,
        tenantId,
        ...preset,
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();
  }

  // ==========================================
  // SALON ALANLARI & STÜDYOLAR (FACILITIES)
  // ==========================================

  watchFacilities(): Observable<GymFacility[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) return of([] as GymFacility[]);
        const q = query(
          collection(this.firestore, 'gym_facilities'),
          where('tenantId', '==', tenantId),
        );
        return (collectionData(q, { idField: 'id' }) as Observable<GymFacility[]>).pipe(
          map((list) =>
            [...list].sort(
              (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
            ),
          ),
        );
      }),
    );
  }

  async createFacility(input: CreateGymFacilityInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    const col = collection(this.firestore, 'gym_facilities');
    const newDoc = doc(col);
    const now = serverTimestamp();

    await setDoc(newDoc, {
      id: newDoc.id,
      tenantId,
      branchId: input.branchId || null,
      name: input.name.trim(),
      disciplineIds: input.disciplineIds || [],
      capacity: Number(input.capacity) || 20,
      description: input.description?.trim() || '',
      status: input.status || 'active',
      createdAt: now,
      updatedAt: now,
    });

    return newDoc.id;
  }

  async updateFacility(id: string, input: UpdateGymFacilityInput): Promise<void> {
    await updateDoc(doc(this.firestore, 'gym_facilities', id), {
      ...input,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteFacility(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'gym_facilities', id));
  }

  // ==========================================
  // CİHAZLAR & EKİPMAN KATALOĞU (EQUIPMENT)
  // ==========================================

  watchEquipment(): Observable<GymEquipment[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) return of([] as GymEquipment[]);
        const q = query(
          collection(this.firestore, 'gym_equipment'),
          where('tenantId', '==', tenantId),
        );
        return (collectionData(q, { idField: 'id' }) as Observable<GymEquipment[]>).pipe(
          map((list) =>
            [...list].sort(
              (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
            ),
          ),
        );
      }),
    );
  }

  async createEquipment(input: CreateGymEquipmentInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    const col = collection(this.firestore, 'gym_equipment');
    const newDoc = doc(col);
    const now = serverTimestamp();

    await setDoc(newDoc, {
      id: newDoc.id,
      tenantId,
      facilityId: input.facilityId || null,
      disciplineId: input.disciplineId || null,
      name: input.name.trim(),
      brandModel: input.brandModel?.trim() || '',
      serialOrTag: input.serialOrTag?.trim() || '',
      targetMuscleGroups: input.targetMuscleGroups || ['chest'],
      quantity: Number(input.quantity) || 1,
      condition: input.condition || 'perfect',
      lastMaintenanceDate: input.lastMaintenanceDate || null,
      notes: input.notes?.trim() || '',
      createdAt: now,
      updatedAt: now,
    });

    return newDoc.id;
  }

  async updateEquipment(id: string, input: UpdateGymEquipmentInput): Promise<void> {
    await updateDoc(doc(this.firestore, 'gym_equipment', id), {
      ...input,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteEquipment(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'gym_equipment', id));
  }

  /** Varsayılan donanımları toplu oluşturur (mükerrer kayıt engelli) */
  async seedDefaultEquipment(): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    const q = query(
      collection(this.firestore, 'gym_equipment'),
      where('tenantId', '==', tenantId),
    );
    const snap = await getDocs(q);
    const existingNames = new Set(snap.docs.map((d) => d.data()['name']?.toLowerCase()));

    const toAdd = DEFAULT_EQUIPMENT_PRESETS.filter(
      (preset) => !existingNames.has(preset.name.toLowerCase()),
    );
    if (toAdd.length === 0) return;

    const batch = writeBatch(this.firestore);
    const now = serverTimestamp();

    for (const preset of toAdd) {
      const newDoc = doc(collection(this.firestore, 'gym_equipment'));
      batch.set(newDoc, {
        id: newDoc.id,
        tenantId,
        ...preset,
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();
  }
}
