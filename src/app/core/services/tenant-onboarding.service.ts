import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { DEFAULT_DISCIPLINES_PRESETS } from '../models/sports-discipline.model';
import { DEFAULT_EQUIPMENT_PRESETS } from '../models/gym-equipment.model';

@Injectable({ providedIn: 'root' })
export class TenantOnboardingService {
  private readonly firestore = inject(Firestore);

  /**
   * Yeni açılan veya henüz ilk kurulumu yapılmamış bir salon için
   * tüm temel varsayılan verileri (Şube, Branşlar, Tesisler, Donanımlar ve Paketler)
   * otomatik olarak Firestore'a ekler.
   */
  async ensureTenantDefaults(tenantId: string, tenantName: string = 'OdivonGYM'): Promise<void> {
    if (!tenantId) return;

    try {
      // 1. ŞUBE KONTROLÜ & OTOMATİK OLUŞTURMA
      const branchesSnap = await getDocs(
        query(collection(this.firestore, 'gym_branches'), where('tenantId', '==', tenantId)),
      );

      let branchId: string | null = null;
      if (branchesSnap.empty) {
        const branchRef = doc(collection(this.firestore, 'gym_branches'));
        branchId = branchRef.id;
        const now = serverTimestamp();

        await writeBatch(this.firestore)
          .set(branchRef, {
            id: branchId,
            tenantId,
            name: `${tenantName} - Merkez Şube`,
            address: 'Bağdat Caddesi No: 142',
            city: 'İstanbul',
            postalCode: '34728',
            phone: '+90 216 450 1020',
            email: 'merkez@odivongym.com',
            website: 'https://odivongym.com',
            capacity: 250,
            currentOccupancy: 0,
            openingHours: ([0, 1, 2, 3, 4, 5, 6] as const).map((day) => ({
              day,
              open: '06:30',
              close: '23:30',
              closed: false,
            })),
            features: [
              'Ağırlık & Kardiyo Katı',
              'Tatami & Boks Ringi',
              'Reformer Stüdyosu',
              'Sauna & Buhar Odası',
              'Vitamin Bar & Cafe',
              'Ücretsiz Otopark',
            ],
            status: 'active',
            managerName: 'Merkez Şube Müdürü',
            createdAt: now,
            updatedAt: now,
          })
          .commit();
      } else {
        branchId = branchesSnap.docs[0].id;
      }

      // 2. SPOR BRANŞLARI (DİSİPLİNLER)
      const disciplinesSnap = await getDocs(
        query(collection(this.firestore, 'sports_disciplines'), where('tenantId', '==', tenantId)),
      );

      if (disciplinesSnap.empty) {
        const batch = writeBatch(this.firestore);
        const now = serverTimestamp();

        for (const preset of DEFAULT_DISCIPLINES_PRESETS) {
          const dRef = doc(collection(this.firestore, 'sports_disciplines'));
          batch.set(dRef, {
            id: dRef.id,
            tenantId,
            ...preset,
            createdAt: now,
            updatedAt: now,
          });
        }
        await batch.commit();
      }

      // 3. SALON ALANLARI / STÜDYOLAR (FACILITIES)
      const facilitiesSnap = await getDocs(
        query(collection(this.firestore, 'gym_facilities'), where('tenantId', '==', tenantId)),
      );

      if (facilitiesSnap.empty) {
        const batch = writeBatch(this.firestore);
        const now = serverTimestamp();

        const defaultFacilities = [
          {
            name: 'Ağırlık & Fitness Katı',
            capacity: 120,
            disciplineIds: [],
            branchId,
            description: 'Serbest ağırlıklar, makineler ve fonksiyonel fitness istasyonları',
            status: 'active',
          },
          {
            name: 'Tatami & Dövüş Ringi',
            capacity: 30,
            disciplineIds: [],
            branchId,
            description: 'Kickboks, Boks ve MMA antrenmanları için darbe emici tatami ve kum torbaları',
            status: 'active',
          },
          {
            name: 'Reformer Pilates Stüdyosu',
            capacity: 15,
            disciplineIds: [],
            branchId,
            description: 'Kuleli ve yaylı reformer aletleri ile özel stüdyo',
            status: 'active',
          },
        ];

        for (const fac of defaultFacilities) {
          const fRef = doc(collection(this.firestore, 'gym_facilities'));
          batch.set(fRef, {
            id: fRef.id,
            tenantId,
            ...fac,
            createdAt: now,
            updatedAt: now,
          });
        }
        await batch.commit();
      }

      // 4. CİHAZ & EKİPMAN KATALOĞU
      const equipSnap = await getDocs(
        query(collection(this.firestore, 'gym_equipment'), where('tenantId', '==', tenantId)),
      );

      if (equipSnap.empty) {
        const batch = writeBatch(this.firestore);
        const now = serverTimestamp();

        for (const preset of DEFAULT_EQUIPMENT_PRESETS) {
          const eRef = doc(collection(this.firestore, 'gym_equipment'));
          batch.set(eRef, {
            id: eRef.id,
            tenantId,
            facilityId: null,
            branchId,
            ...preset,
            createdAt: now,
            updatedAt: now,
          });
        }
        await batch.commit();
      }

      // 5. ÜYELİK PAKETLERİ (PACKAGES)
      const pkgSnap = await getDocs(
        query(collection(this.firestore, 'gym_packages'), where('tenantId', '==', tenantId)),
      );

      if (pkgSnap.empty) {
        const batch = writeBatch(this.firestore);
        const now = serverTimestamp();

        const defaultPackages = [
          {
            name: '1 Aylık Standart',
            durationDays: 30,
            price: 1500,
            description: 'Tüm fitness ve kardiyo alanına sınırsız erişim',
            features: ['Fitness ve Ağırlık Katı', 'Soyunma Odası & Duş', 'Mobil Uygulama Erişimi'],
            maxFreeze: 0,
            trialEligible: false,
            status: 'active',
          },
          {
            name: '3 Aylık Fit Paket',
            durationDays: 90,
            price: 3800,
            description: 'Grup dersleri ve sauna dahil en popüler paket',
            features: ['Fitness & Kardiyo Katı', 'Grup Dersleri Katılımı', 'Sauna Erişimi', '15 Gün Üyelik Dondurma'],
            maxFreeze: 15,
            trialEligible: true,
            status: 'active',
          },
          {
            name: '6 Aylık Pro Paket',
            durationDays: 180,
            price: 6900,
            description: 'Gelişmiş antrenman takibi ve vitamin bar avantajları',
            features: ['Tüm Salon Alanlarına Erişim', 'Kickboks & Boks Seansları', '1 Ay Üyelik Dondurma', '%10 Vitamin Bar İndirimi'],
            maxFreeze: 30,
            trialEligible: false,
            status: 'active',
          },
          {
            name: '1 Yıllık VIP Gold',
            durationDays: 365,
            price: 11900,
            description: 'Sınırsız grup dersleri, özel ölçüm ve antrenör desteği',
            features: ['Sınırsız Tüm Alanlar', 'Aylık Vücut Analizleri (InBody)', '2 Ay Üyelik Dondurma', 'Özel Dolap'],
            maxFreeze: 60,
            trialEligible: false,
            status: 'active',
          },
        ];

        for (const pkg of defaultPackages) {
          const pRef = doc(collection(this.firestore, 'gym_packages'));
          batch.set(pRef, {
            id: pRef.id,
            tenantId,
            ...pkg,
            createdAt: now,
            updatedAt: now,
          });
        }
        await batch.commit();
      }
    } catch (err) {
      console.warn('OdivonGYM: Tenant varsayılanları oluşturulurken uyarı:', err);
    }
  }
}
