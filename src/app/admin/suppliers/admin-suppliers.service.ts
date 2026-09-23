import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import {
  CreateSupplierInput,
  DEFAULT_SUPPLIER_CATEGORIES,
  Supplier,
  SupplierCategoryItem,
  UpdateSupplierInput,
} from '../../core/models/supplier.model';

@Injectable({ providedIn: 'root' })
export class AdminSuppliersService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private categorySeedingTriggered = false;

  watchCategories(): Observable<SupplierCategoryItem[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId || profile?.uid;
        if (!tenantId) return of([] as SupplierCategoryItem[]);
        const q = query(collection(this.firestore, 'gym_supplier_categories'), where('tenantId', '==', tenantId));
        return (collectionData(q, { idField: 'id' }) as Observable<SupplierCategoryItem[]>).pipe(
          map((list) => {
            if (list.length === 0 && !this.categorySeedingTriggered) {
              this.categorySeedingTriggered = true;
              void this.seedDefaultCategoriesIfEmpty(tenantId);
            }
            return [...list].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
          }),
          catchError((err) => {
            console.warn('OdivonGYM: tedarikçi kategorileri dinlenirken hata oluştu:', err);
            return of([] as SupplierCategoryItem[]);
          }),
        );
      }),
    );
  }

  async createCategory(input: { name: string; colorTag?: string; description?: string }): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId || this.auth.profile()?.uid;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');

    const key = input.name.toLowerCase().trim()
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '_');

    const color = input.colorTag || 'indigo';
    const badgeClass = `bg-${color}-50 text-${color}-700 border-${color}-200 dark:bg-${color}-950/60 dark:text-${color}-300 dark:border-${color}-800`;

    const docRef = await addDoc(collection(this.firestore, 'gym_supplier_categories'), {
      tenantId,
      key,
      name: input.name.trim(),
      colorTag: color,
      badgeClass,
      description: input.description?.trim() || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  async updateCategory(id: string, input: Partial<SupplierCategoryItem>): Promise<void> {
    const cleanData: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) {
        cleanData[k] = v;
      }
    }
    await updateDoc(doc(this.firestore, 'gym_supplier_categories', id), cleanData);
  }

  async deleteCategory(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'gym_supplier_categories', id));
  }

  async seedDefaultCategoriesIfEmpty(tenantIdParam?: string): Promise<void> {
    const tenantId = tenantIdParam || this.auth.profile()?.tenantId || this.auth.profile()?.uid;
    if (!tenantId) return;

    const q = query(collection(this.firestore, 'gym_supplier_categories'), where('tenantId', '==', tenantId));
    const snap = await getDocs(q);
    if (!snap.empty) return;

    const batch = writeBatch(this.firestore);
    const now = serverTimestamp();

    for (const cat of DEFAULT_SUPPLIER_CATEGORIES) {
      const docRef = doc(collection(this.firestore, 'gym_supplier_categories'));
      batch.set(docRef, {
        id: docRef.id,
        tenantId,
        key: cat.key,
        name: cat.name,
        colorTag: cat.colorTag || 'indigo',
        badgeClass: cat.badgeClass || '',
        description: cat.description || '',
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();
  }

  watchSuppliers(): Observable<Supplier[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId || profile?.uid;
        if (!tenantId) return of([] as Supplier[]);
        const q = query(collection(this.firestore, 'gym_suppliers'), where('tenantId', '==', tenantId));
        return (collectionData(q, { idField: 'id' }) as Observable<Supplier[]>).pipe(
          map((list) =>
            [...list].sort((a, b) => this.safeTs(b.createdAt) - this.safeTs(a.createdAt)),
          ),
          catchError((err) => {
            console.warn('OdivonGYM: tedarikçiler dinlenirken hata oluştu:', err);
            return of([] as Supplier[]);
          }),
        );
      }),
    );
  }

  private safeTs(ts: any): number {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === 'string' || typeof ts === 'number') {
      const ms = new Date(ts).getTime();
      return isNaN(ms) ? 0 : ms;
    }
    return 0;
  }

  async createSupplier(input: CreateSupplierInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId || this.auth.profile()?.uid;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');

    const cleanData: Record<string, any> = {
      tenantId,
      name: input.name.trim(),
      contactPerson: input.contactPerson?.trim() || '',
      category: input.category || 'other',
      phone: input.phone?.trim() || '',
      email: input.email?.trim() || '',
      taxOffice: input.taxOffice?.trim() || '',
      taxNumber: input.taxNumber?.trim() || '',
      balance: Number(input.balance) || 0,
      iban: input.iban?.trim() || '',
      address: input.address?.trim() || '',
      notes: input.notes?.trim() || '',
      status: input.status || 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(this.firestore, 'gym_suppliers'), cleanData);
    return docRef.id;
  }

  async updateSupplier(id: string, input: UpdateSupplierInput): Promise<void> {
    const cleanData: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) {
        cleanData[k] = v;
      }
    }
    await updateDoc(doc(this.firestore, 'gym_suppliers', id), cleanData);
  }

  async deleteSupplier(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'gym_suppliers', id));
  }

  /** İlk açılışta salona hazır örnek tedarikçiler ekler (mükerrer kayıt engelli) */
  async seedDefaultSuppliers(): Promise<number> {
    const tenantId = this.auth.profile()?.tenantId || this.auth.profile()?.uid;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');

    const q = query(collection(this.firestore, 'gym_suppliers'), where('tenantId', '==', tenantId));
    const snap = await getDocs(q);
    const existingNames = new Set(snap.docs.map((d) => d.data()['name']?.toLowerCase()));

    const presets: CreateSupplierInput[] = [
      {
        name: 'Technogym Fitness Ekipmanları A.Ş.',
        contactPerson: 'Murat Yılmaz',
        category: 'equipment',
        phone: '0212 345 6789',
        email: 'destek@technogym.com.tr',
        taxOffice: 'Beşiktaş',
        taxNumber: '8390214820',
        balance: 14500,
        iban: 'TR33 0006 1005 1978 6100 2490 01',
        status: 'active',
      },
      {
        name: 'Hardline Nutrition & Protein Gıda',
        contactPerson: 'Selin Aksoy',
        category: 'supplements',
        phone: '0216 450 9080',
        email: 'siparis@hardline.com.tr',
        taxOffice: 'Kadıköy',
        taxNumber: '4620194812',
        balance: 4200,
        iban: 'TR62 0001 5001 5800 7301 9283 02',
        status: 'active',
      },
      {
        name: 'Kuzey İçecek & Otomat Hizmetleri',
        contactPerson: 'Emre Çetin',
        category: 'beverage',
        phone: '0850 302 4455',
        email: 'info@kuzeyicecek.com',
        taxOffice: 'Ümraniye',
        taxNumber: '5820193481',
        balance: 0,
        iban: 'TR11 0006 2000 1289 0001 8291 03',
        status: 'active',
      },
    ];

    const toAdd = presets.filter((p) => !existingNames.has(p.name.toLowerCase()));
    if (toAdd.length === 0) return 0;

    const batch = writeBatch(this.firestore);
    const now = serverTimestamp();

    for (const p of toAdd) {
      const docRef = doc(collection(this.firestore, 'gym_suppliers'));
      batch.set(docRef, {
        id: docRef.id,
        tenantId,
        name: p.name,
        contactPerson: p.contactPerson || '',
        category: p.category || 'other',
        phone: p.phone || '',
        email: p.email || '',
        taxOffice: p.taxOffice || '',
        taxNumber: p.taxNumber || '',
        balance: p.balance || 0,
        iban: p.iban || '',
        status: p.status || 'active',
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();
    return toAdd.length;
  }
}
