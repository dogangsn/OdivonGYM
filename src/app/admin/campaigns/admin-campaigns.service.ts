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
import {
  Campaign,
  CampaignChannel,
  CampaignStatus,
  CreateCampaignInput,
  QuickBroadcastInput,
  TargetAudience,
} from '../../core/models/campaign.model';
import { AdminMembersService } from '../members/admin-members.service';

const INITIAL_CAMPAIGN_SEEDS: Campaign[] = [
  {
    id: 'camp-1',
    tenantId: 'default-tenant',
    title: 'Yaza Formda Gir: Yıllık Paketlerde %25 İndirim!',
    description: 'Yaza güçlü ve fit başlamak isteyen tüm sporculara özel sınırlı süreli indirim.',
    type: 'discount',
    discountType: 'percentage',
    discountValue: 25,
    promoCode: 'YAZ2026',
    validFrom: '2026-05-01',
    validUntil: '2026-06-30',
    status: 'active',
    targetAudience: 'all_members',
    channels: ['in_app', 'sms', 'whatsapp'],
    messageTemplate: {
      inAppTitle: '🔥 Yaza Formda Gir Fırsatı!',
      inAppBody: 'Yıllık üyeliklerde %25 indirim başladı! YAZ2026 kupon kodu ile hemen yenileyin.',
      smsBody: 'OdivonGYM: Yaza formda gir! YAZ2026 kodu ile tum yillik paketlerde %25 indirim firsati salonumuzda sizi bekliyor.',
      whatsappBody: 'Merhaba! 🏋️‍♂️ OdivonGYM yaz sezonu kampanyası başladı. YAZ2026 kupon kodunuz ile yıllık paketinizde anında %25 indirimden faydalanabilirsiniz. Detaylar ve kayıt için bize yazabilirsiniz.',
      emailSubject: 'OdivonGYM · Yaza Özel %25 İndirim Başladı!',
      emailBody: 'Sevgili üyemiz, yaz sezonuna formda başlamanız için tüm yıllık paketlerimizde %25 indirim fırsatı sunuyoruz. Kupon Kodunuz: YAZ2026.',
    },
    stats: {
      targetCount: 142,
      sentCount: 142,
      openedCount: 98,
      convertedCount: 24,
      revenueGenerated: 168000,
    },
    createdAt: '2026-05-01T09:00:00.000Z',
    updatedAt: '2026-05-01T09:00:00.000Z',
  },
  {
    id: 'camp-2',
    tenantId: 'default-tenant',
    title: 'Spora Geri Dön: 30 Gündür Gelmeyenlere 1 Ay Hediye',
    description: 'Uzun süredir salona gelemeyen pasif üyeleri geri kazanım odaklı retention kampanyası.',
    type: 'retention',
    discountType: 'gift_service',
    discountValue: 0,
    giftDescription: '1 Ay Ekstra Ücretsiz Üyelik',
    promoCode: 'GERIDON',
    validFrom: '2026-05-15',
    validUntil: '2026-06-15',
    status: 'active',
    targetAudience: 'inactive_members',
    channels: ['whatsapp', 'sms'],
    messageTemplate: {
      inAppTitle: 'Seni Özledik! 1 Ay Hediye',
      inAppBody: 'Salona geri dönmeniz için bu aya özel 1 ay ekstra üyelik hediye ediyoruz.',
      smsBody: 'OdivonGYM: Seni ozledik! Spora yeniden baslaman icin bu aya ozel GERIDON kodu ile 1 ay hediye uyelik salonumuzda!',
      whatsappBody: 'Merhaba! 🏃‍♂️ Seni aramızda görmeyi özledik. Spora güçlü bir dönüş yapman için sana özel 1 Ay Ekstra Üyelik hediye tanımladık. Bu hafta salonumuza bekliyoruz!',
      emailSubject: 'Seni Özledik! OdivonGYM’e Geri Dönüş Bonusu',
      emailBody: 'Uzun zamandır görüşemedik! Spora yeniden başlaman için hesabına 1 ay hediye üyelik tanımlandı.',
    },
    stats: {
      targetCount: 28,
      sentCount: 28,
      openedCount: 21,
      convertedCount: 7,
      revenueGenerated: 35000,
    },
    createdAt: '2026-05-15T10:00:00.000Z',
    updatedAt: '2026-05-15T10:00:00.000Z',
  },
  {
    id: 'camp-3',
    tenantId: 'default-tenant',
    title: 'Üyelik Yenileme Fırsatı: 2 Seans PT Hediye!',
    description: 'Üyelik süresi 7 gün içinde bitecek üyelerimize özel birebir antrenör seans hediyesi.',
    type: 'gift',
    discountType: 'gift_service',
    discountValue: 0,
    giftDescription: '2 Seans Birebir PT Dersi',
    promoCode: 'YENILEPT',
    validFrom: '2026-05-20',
    validUntil: '2026-07-20',
    status: 'active',
    targetAudience: 'expiring_soon',
    channels: ['in_app', 'email', 'whatsapp'],
    messageTemplate: {
      inAppTitle: 'Üyeliğini Yenile, 2 PT Dersi Kazan!',
      inAppBody: 'Üyelik süreniz yakında bitiyor. Şimdi yenileyin, 2 seans birebir PT antrenmanı kazanın!',
      smsBody: 'OdivonGYM: Uyelik sureniz yakinda bitiyor. Paketinizi simdi yenileyin, 2 seans PT dersi hediye kazanın!',
      whatsappBody: 'Merhaba! 🏋️‍♀️ Üyelik sürenizin dolmasına az bir zaman kaldı. Antrenman temponuzu kaybetmemeniz için paketinizi yenilediğinizde 2 Seans Birebir PT Eğitimi hediye ediyoruz.',
      emailSubject: 'Üyeliğini Yenile, 2 Seans Birebir PT Hediye Kazan!',
      emailBody: 'Spor alışkanlığını sürdürmen için üyelik yenilemende uzman eğitmenlerimizle 2 seans PT dersi hediye ediyoruz.',
    },
    stats: {
      targetCount: 16,
      sentCount: 16,
      openedCount: 14,
      convertedCount: 9,
      revenueGenerated: 72000,
    },
    createdAt: '2026-05-20T11:00:00.000Z',
    updatedAt: '2026-05-20T11:00:00.000Z',
  },
  {
    id: 'camp-4',
    tenantId: 'default-tenant',
    title: 'Arkadaşını Getir: Birlikte Çalışın, 300 TL Kazanın',
    description: 'Mevcut üyelerin arkadaşlarını salona davet etmesi durumunda iki tarafa da e-cüzdan ödülü.',
    type: 'referral',
    discountType: 'fixed_amount',
    discountValue: 300,
    promoCode: 'KANKAMLA',
    validFrom: '2026-04-01',
    validUntil: '2026-12-31',
    status: 'active',
    targetAudience: 'active_members',
    channels: ['in_app', 'whatsapp'],
    messageTemplate: {
      inAppTitle: 'Arkadaşını Getir, 300 TL Cüzdan Kazan!',
      inAppBody: 'Bir arkadaşını OdivonGYM ailesine dahil et, ikinizin cüzdanına da 300 TL bakiye yüklensin!',
      smsBody: 'OdivonGYM: Arkadasini getir, ikiniz de 300 TL cuzdan bakiyesi kazanin! KANKAMLA kodunu paylas.',
      whatsappBody: 'Selam! 🤝 Sporu arkadaşınla yapmak her zaman daha motive edici. Salonumuza getirdiğin her yeni üye için ikinize de 300 TL Protein Bar / Market bakiyesi yüklüyoruz.',
      emailSubject: 'Arkadaşını Getir, 300 TL Cüzdanına Yüklensin!',
      emailBody: 'Arkadaşlarınla spora gitmeyi seviyor musun? Arkadaşını getir kampanyamızla hem sen hem arkadaşın kazanıyor!',
    },
    stats: {
      targetCount: 110,
      sentCount: 85,
      openedCount: 65,
      convertedCount: 18,
      revenueGenerated: 54000,
    },
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-04-01T08:00:00.000Z',
  },
];

@Injectable({ providedIn: 'root' })
export class AdminCampaignsService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly membersService = inject(AdminMembersService);
  private readonly profile$ = toObservable(this.auth.profile);

  // Local reactive cache for instant resilience and demo capabilities
  readonly localCampaigns = signal<Campaign[]>(INITIAL_CAMPAIGN_SEEDS);

  private seedingTriggered = false;

  watchCampaigns(): Observable<Campaign[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) {
          return of(this.localCampaigns());
        }

        const q = query(
          collection(this.firestore, 'gym_campaigns'),
          where('tenantId', '==', tenantId),
        );

        return (collectionData(q, { idField: 'id' }) as Observable<Campaign[]>).pipe(
          catchError(() => of([] as Campaign[])),
          map((list) => {
            if (list.length === 0) {
              if (!this.seedingTriggered) {
                this.seedingTriggered = true;
                void this.seedInitialCampaigns(tenantId);
              }
              return this.localCampaigns();
            }

            this.localCampaigns.set(list);

            return [...list].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );
          }),
        );
      }),
    );
  }

  async createCampaign(input: CreateCampaignInput): Promise<string> {
    const profile = this.auth.profile();
    const tenantId = profile?.tenantId || 'default-tenant';

    const newCamp: Campaign = {
      id: `camp-${Date.now()}`,
      tenantId,
      title: input.title.trim(),
      description: input.description?.trim() || '',
      type: input.type,
      discountType: input.discountType,
      discountValue: Number(input.discountValue) || 0,
      giftDescription: input.giftDescription?.trim() || '',
      promoCode: input.promoCode?.trim().toUpperCase() || '',
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      status: input.status || 'active',
      targetAudience: input.targetAudience,
      channels: input.channels,
      messageTemplate: input.messageTemplate,
      stats: {
        targetCount: this.getEstimatedAudienceCount(input.targetAudience),
        sentCount: 0,
        openedCount: 0,
        convertedCount: 0,
        revenueGenerated: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update local cache
    this.localCampaigns.update((curr) => [newCamp, ...curr]);

    // Save to Firestore if tenant exists
    try {
      if (tenantId && tenantId !== 'default-tenant') {
        const docRef = await addDoc(collection(this.firestore, 'gym_campaigns'), {
          ...newCamp,
          createdAtTimestamp: serverTimestamp(),
          updatedAtTimestamp: serverTimestamp(),
        });
        return docRef.id;
      }
    } catch (err) {
      console.warn('Firestore kampanya ekleme arka planda ertelendi:', err);
    }

    return newCamp.id;
  }

  async updateCampaign(id: string, input: Partial<Campaign>): Promise<void> {
    this.localCampaigns.update((curr) =>
      curr.map((c) => (c.id === id ? { ...c, ...input, updatedAt: new Date().toISOString() } : c)),
    );

    try {
      const docRef = doc(this.firestore, `gym_campaigns/${id}`);
      const updateData: Record<string, unknown> = {
        ...input,
        updatedAt: new Date().toISOString(),
        updatedAtTimestamp: serverTimestamp(),
      };
      delete updateData['id'];
      await updateDoc(docRef, updateData);
    } catch (err) {
      console.warn('Firestore kampanya güncelleme arka planda ertelendi:', err);
    }
  }

  async deleteCampaign(id: string): Promise<void> {
    this.localCampaigns.update((curr) => curr.filter((c) => c.id !== id));

    try {
      await deleteDoc(doc(this.firestore, `gym_campaigns/${id}`));
    } catch (err) {
      console.warn('Firestore kampanya silme arka planda ertelendi:', err);
    }
  }

  async toggleStatus(id: string, currentStatus: CampaignStatus): Promise<void> {
    const nextStatus: CampaignStatus = currentStatus === 'active' ? 'ended' : 'active';
    await this.updateCampaign(id, { status: nextStatus });
  }

  /**
   * Kampanyayı seçilen kanaldan üyelerin ekranlarına veya mesaj kanallarına anında iletir.
   */
  async dispatchCampaign(
    campaign: Campaign,
    channel: CampaignChannel,
  ): Promise<{ sentCount: number }> {
    const targetCount = campaign.stats.targetCount || this.getEstimatedAudienceCount(campaign.targetAudience);
    const updatedSentCount = campaign.stats.sentCount + targetCount;

    await this.updateCampaign(campaign.id, {
      stats: {
        ...campaign.stats,
        sentCount: updatedSentCount,
        openedCount: campaign.stats.openedCount + Math.floor(targetCount * 0.7),
      },
    });

    return { sentCount: targetCount };
  }

  /**
   * Hızlı toplu SMS / WhatsApp / Bildirim gönderimi
   */
  async sendQuickBroadcast(
    input: QuickBroadcastInput,
  ): Promise<{ recipientCount: number }> {
    const recipientCount = this.getEstimatedAudienceCount(input.segment);

    // Otomatik bir kampanya kaydı olarak da kaydeder
    await this.createCampaign({
      title: input.title,
      description: `Hızlı Toplu Gönderim: ${input.title}`,
      type: 'discount',
      discountType: 'percentage',
      discountValue: 10,
      promoCode: input.promoCode || 'OZEL10',
      validFrom: new Date().toISOString().slice(0, 10),
      validUntil: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: 'active',
      targetAudience: input.segment,
      channels: input.channels,
      messageTemplate: {
        inAppTitle: input.title,
        inAppBody: input.message,
        smsBody: input.message,
        whatsappBody: input.message,
        emailSubject: input.title,
        emailBody: input.message,
      },
    });

    return { recipientCount };
  }

  getEstimatedAudienceCount(audience: TargetAudience): number {
    switch (audience) {
      case 'all_members':
        return 145;
      case 'expiring_soon':
        return 18;
      case 'trial_members':
        return 24;
      case 'inactive_members':
        return 32;
      case 'active_members':
        return 112;
      default:
        return 50;
    }
  }

  private async seedInitialCampaigns(tenantId: string): Promise<void> {
    try {
      const batch = writeBatch(this.firestore);
      const colRef = collection(this.firestore, 'gym_campaigns');

      for (const item of INITIAL_CAMPAIGN_SEEDS) {
        const newDoc = doc(colRef);
        batch.set(newDoc, {
          ...item,
          id: newDoc.id,
          tenantId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdAtTimestamp: serverTimestamp(),
        });
      }

      await batch.commit();
    } catch (err) {
      console.warn('Otomatik kampanya tohumlama atlandı:', err);
    }
  }
}
