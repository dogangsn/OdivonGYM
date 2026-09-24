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

/** Türkçe karakter, aksan ve boşluk duyarlı normalize anahtar üretir (mükerrer kayıt kontrolü için) */
export function normalizeDisciplineKey(str: string): string {
  return (str || '')
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ıiİI]/g, 'i')
    .replace(/[ğgĞG]/g, 'g')
    .replace(/[üuÜU]/g, 'u')
    .replace(/[şsŞS]/g, 's')
    .replace(/[öoÖO]/g, 'o')
    .replace(/[çcÇC]/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

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

    const normInput = normalizeDisciplineKey(input.name);
    if (!normInput) throw new Error('Geçerli bir branş adı giriniz.');

    const q = query(
      collection(this.firestore, 'sports_disciplines'),
      where('tenantId', '==', tenantId),
    );
    const snap = await getDocs(q);
    const conflict = snap.docs.find((d) => {
      const data = d.data();
      const sameName = normalizeDisciplineKey(data['name'] || '') === normInput;
      const sameCode = input.code !== 'other' && data['code'] === input.code;
      return sameName || sameCode;
    });

    if (conflict) {
      const data = conflict.data();
      if (normalizeDisciplineKey(data['name'] || '') === normInput) {
        throw new Error(`"${input.name.trim()}" isimli bir spor branşı zaten kayıtlı.`);
      }
      throw new Error(`"${input.code}" koduna sahip bir spor branşı zaten mevcut.`);
    }

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

    if (input.name || input.code) {
      const q = query(
        collection(this.firestore, 'sports_disciplines'),
        where('tenantId', '==', tenantId),
      );
      const snap = await getDocs(q);
      const normInput = input.name ? normalizeDisciplineKey(input.name) : null;
      const conflict = snap.docs.find((d) => {
        if (d.id === id) return false;
        const data = d.data();
        const sameName = normInput && normalizeDisciplineKey(data['name'] || '') === normInput;
        const sameCode = input.code && input.code !== 'other' && data['code'] === input.code;
        return sameName || sameCode;
      });

      if (conflict) {
        throw new Error('Bu isim veya koda sahip başka bir spor branşı zaten mevcut.');
      }
    }

    const cleanUpdate: Record<string, any> = {
      ...input,
      updatedAt: serverTimestamp(),
    };
    if (input.name !== undefined) cleanUpdate['name'] = input.name.trim();
    if (input.description !== undefined) cleanUpdate['description'] = input.description.trim();

    await updateDoc(doc(this.firestore, 'sports_disciplines', id), cleanUpdate);
  }

  async deleteDiscipline(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'sports_disciplines', id));
  }

  /** Salon için varsayılan branşları toplu oluşturur (mükerrer kayıt engelli) */
  async seedDefaultDisciplines(): Promise<{ added: number; skipped: number }> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    const q = query(
      collection(this.firestore, 'sports_disciplines'),
      where('tenantId', '==', tenantId),
    );
    const snap = await getDocs(q);
    const existingCodes = new Set(snap.docs.map((d) => d.data()['code']));
    const existingNormNames = new Set(
      snap.docs.map((d) => normalizeDisciplineKey(d.data()['name'] || '')),
    );

    const toAdd = DEFAULT_DISCIPLINES_PRESETS.filter(
      (preset) =>
        !existingCodes.has(preset.code) &&
        !existingNormNames.has(normalizeDisciplineKey(preset.name)),
    );

    if (toAdd.length === 0) {
      return { added: 0, skipped: DEFAULT_DISCIPLINES_PRESETS.length };
    }

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
    return { added: toAdd.length, skipped: DEFAULT_DISCIPLINES_PRESETS.length - toAdd.length };
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

    const normName = normalizeDisciplineKey(input.name);
    if (!normName) throw new Error('Geçerli bir stüdyo/alan adı giriniz.');

    const q = query(
      collection(this.firestore, 'gym_facilities'),
      where('tenantId', '==', tenantId),
    );
    const snap = await getDocs(q);
    const exists = snap.docs.some(
      (d) => normalizeDisciplineKey(d.data()['name'] || '') === normName,
    );
    if (exists) {
      throw new Error(`"${input.name.trim()}" isimli bir alan / stüdyo zaten kayıtlı.`);
    }

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
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    if (input.name) {
      const normName = normalizeDisciplineKey(input.name);
      const q = query(
        collection(this.firestore, 'gym_facilities'),
        where('tenantId', '==', tenantId),
      );
      const snap = await getDocs(q);
      const exists = snap.docs.some(
        (d) => d.id !== id && normalizeDisciplineKey(d.data()['name'] || '') === normName,
      );
      if (exists) {
        throw new Error(`"${input.name.trim()}" isimli başka bir alan / stüdyo zaten mevcut.`);
      }
    }

    const cleanUpdate: Record<string, any> = {
      ...input,
      updatedAt: serverTimestamp(),
    };
    if (input.name !== undefined) cleanUpdate['name'] = input.name.trim();
    if (input.description !== undefined) cleanUpdate['description'] = input.description.trim();

    await updateDoc(doc(this.firestore, 'gym_facilities', id), cleanUpdate);
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

    const normName = normalizeDisciplineKey(input.name);
    if (!normName) throw new Error('Geçerli bir cihaz / ekipman adı giriniz.');

    const q = query(
      collection(this.firestore, 'gym_equipment'),
      where('tenantId', '==', tenantId),
    );
    const snap = await getDocs(q);
    const exists = snap.docs.some(
      (d) => normalizeDisciplineKey(d.data()['name'] || '') === normName,
    );
    if (exists) {
      throw new Error(`"${input.name.trim()}" isimli bir cihaz / ekipman envanterde zaten kayıtlı.`);
    }

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
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    if (input.name) {
      const normName = normalizeDisciplineKey(input.name);
      const q = query(
        collection(this.firestore, 'gym_equipment'),
        where('tenantId', '==', tenantId),
      );
      const snap = await getDocs(q);
      const exists = snap.docs.some(
        (d) => d.id !== id && normalizeDisciplineKey(d.data()['name'] || '') === normName,
      );
      if (exists) {
        throw new Error(`"${input.name.trim()}" isimli başka bir cihaz / ekipman zaten mevcut.`);
      }
    }

    const cleanUpdate: Record<string, any> = {
      ...input,
      updatedAt: serverTimestamp(),
    };
    if (input.name !== undefined) cleanUpdate['name'] = input.name.trim();
    if (input.brandModel !== undefined) cleanUpdate['brandModel'] = input.brandModel.trim();
    if (input.serialOrTag !== undefined) cleanUpdate['serialOrTag'] = input.serialOrTag.trim();
    if (input.notes !== undefined) cleanUpdate['notes'] = input.notes.trim();

    await updateDoc(doc(this.firestore, 'gym_equipment', id), cleanUpdate);
  }

  async deleteEquipment(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'gym_equipment', id));
  }

  /** Varsayılan donanımları toplu oluşturur (mükerrer kayıt engelli) */
  async seedDefaultEquipment(): Promise<{ added: number; skipped: number }> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    const q = query(
      collection(this.firestore, 'gym_equipment'),
      where('tenantId', '==', tenantId),
    );
    const snap = await getDocs(q);
    const existingNormNames = new Set(
      snap.docs.map((d) => normalizeDisciplineKey(d.data()['name'] || '')),
    );

    const toAdd = DEFAULT_EQUIPMENT_PRESETS.filter(
      (preset) => !existingNormNames.has(normalizeDisciplineKey(preset.name)),
    );

    if (toAdd.length === 0) {
      return { added: 0, skipped: DEFAULT_EQUIPMENT_PRESETS.length };
    }

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
    return { added: toAdd.length, skipped: DEFAULT_EQUIPMENT_PRESETS.length - toAdd.length };
  }

  /**
   * Salon için mükerrer spor branşlarını ve cihazları tarar,
   * en eski olanı tutup mükerrer kopyaları temizler.
   */
  async cleanupDuplicateRecords(): Promise<{
    deletedDisciplines: number;
    deletedEquipment: number;
  }> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    let deletedDisciplines = 0;
    let deletedEquipment = 0;

    // 1. Taranacak: sports_disciplines
    const discSnap = await getDocs(
      query(collection(this.firestore, 'sports_disciplines'), where('tenantId', '==', tenantId)),
    );
    const discGroups = new Map<string, { id: string; createdAtMs: number }[]>();
    discSnap.docs.forEach((d) => {
      const data = d.data();
      const key =
        data['code'] && data['code'] !== 'other'
          ? data['code']
          : normalizeDisciplineKey(data['name'] || '');
      const createdAtMs = data['createdAt']?.toMillis ? data['createdAt'].toMillis() : 0;
      if (!discGroups.has(key)) discGroups.set(key, []);
      discGroups.get(key)!.push({ id: d.id, createdAtMs });
    });

    const discBatch = writeBatch(this.firestore);
    let hasDiscDeletes = false;
    for (const [, group] of discGroups.entries()) {
      if (group.length > 1) {
        group.sort((a, b) => a.createdAtMs - b.createdAtMs);
        for (let i = 1; i < group.length; i++) {
          discBatch.delete(doc(this.firestore, 'sports_disciplines', group[i].id));
          deletedDisciplines++;
          hasDiscDeletes = true;
        }
      }
    }
    if (hasDiscDeletes) {
      await discBatch.commit();
    }

    // 2. Taranacak: gym_equipment
    const eqSnap = await getDocs(
      query(collection(this.firestore, 'gym_equipment'), where('tenantId', '==', tenantId)),
    );
    const eqGroups = new Map<string, { id: string; createdAtMs: number }[]>();
    eqSnap.docs.forEach((d) => {
      const data = d.data();
      const key = normalizeDisciplineKey(data['name'] || '');
      const createdAtMs = data['createdAt']?.toMillis ? data['createdAt'].toMillis() : 0;
      if (!eqGroups.has(key)) eqGroups.set(key, []);
      eqGroups.get(key)!.push({ id: d.id, createdAtMs });
    });

    const eqBatch = writeBatch(this.firestore);
    let hasEqDeletes = false;
    for (const [, group] of eqGroups.entries()) {
      if (group.length > 1) {
        group.sort((a, b) => a.createdAtMs - b.createdAtMs);
        for (let i = 1; i < group.length; i++) {
          eqBatch.delete(doc(this.firestore, 'gym_equipment', group[i].id));
          deletedEquipment++;
          hasEqDeletes = true;
        }
      }
    }
    if (hasEqDeletes) {
      await eqBatch.commit();
    }

    return { deletedDisciplines, deletedEquipment };
  }
}
