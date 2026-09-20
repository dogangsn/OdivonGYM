import { Injectable, inject } from '@angular/core';
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
import { Observable, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { CreateSupplierInput, Supplier, UpdateSupplierInput } from '../../core/models/supplier.model';

@Injectable({ providedIn: 'root' })
export class AdminSuppliersService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);

  watchSuppliers(): Observable<Supplier[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) return of([] as Supplier[]);
        const q = query(collection(this.firestore, 'gym_suppliers'), where('tenantId', '==', tenantId));
        return (collectionData(q, { idField: 'id' }) as Observable<Supplier[]>).pipe(
          map((list) =>
            [...list].sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)),
          ),
        );
      }),
    );
  }

  async createSupplier(input: CreateSupplierInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');

    const docRef = await addDoc(collection(this.firestore, 'gym_suppliers'), {
      tenantId,
      name: input.name.trim(),
      contactPerson: input.contactPerson?.trim() || '',
      category: input.category || 'other',
      phone: input.phone.trim(),
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
    });

    return docRef.id;
  }

  async updateSupplier(id: string, input: UpdateSupplierInput): Promise<void> {
    await updateDoc(doc(this.firestore, 'gym_suppliers', id), {
      ...input,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteSupplier(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'gym_suppliers', id));
  }

  /** İlk açılışta salona hazır örnek tedarikçiler ekler */
  async seedDefaultSuppliers(): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) return;

    const batch = writeBatch(this.firestore);
    const now = serverTimestamp();

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

    for (const p of presets) {
      const docRef = doc(collection(this.firestore, 'gym_suppliers'));
      batch.set(docRef, {
        id: docRef.id,
        tenantId,
        ...p,
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();
  }
}
