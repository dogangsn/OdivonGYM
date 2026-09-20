export type CampaignType =
  | 'discount'   // Sezonluk & Özel İndirim
  | 'referral'   // Arkadaşını Getir
  | 'event'      // Workshop & Etkinlik
  | 'retention'  // Geri Kazanım & Yenileme
  | 'gift';      // Hediye PT / Bar İkramı

export type DiscountType = 'percentage' | 'fixed_amount' | 'gift_service';

export type TargetAudience =
  | 'all_members'        // Tüm Kayıtlı Üyeler
  | 'expiring_soon'      // Üyeliği 7 Gün İçinde Bitecekler
  | 'trial_members'      // Ücretsiz Deneme Süresindekiler
  | 'inactive_members'   // 30 Gündür Gelmeyenler (Churn Risk)
  | 'active_members';    // Düzenli Gelen Aktif Üyeler

export type CampaignChannel = 'in_app' | 'sms' | 'whatsapp' | 'email';

export type CampaignStatus = 'active' | 'draft' | 'scheduled' | 'ended';

export interface CampaignMessageTemplate {
  inAppTitle?: string;
  inAppBody?: string;
  smsBody?: string;
  emailSubject?: string;
  emailBody?: string;
  whatsappBody?: string;
}

export interface CampaignStats {
  targetCount: number;      // Hedeflenen üye sayısı
  sentCount: number;        // İletilen bildirim/mesaj
  openedCount: number;      // Görüntüleyen/açan
  convertedCount: number;   // Kampanyadan yararlanan
  revenueGenerated: number; // Üretilen toplam gelir (TL)
}

export interface Campaign {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  type: CampaignType;
  discountType: DiscountType;
  discountValue: number; // Yüzde veya TL tutarı
  giftDescription?: string; // Örn: '1 Seans Ücretsiz Reformer PT'
  promoCode?: string; // Örn: 'YAZ2026'
  validFrom: string; // YYYY-MM-DD
  validUntil: string; // YYYY-MM-DD
  status: CampaignStatus;
  targetAudience: TargetAudience;
  channels: CampaignChannel[];
  messageTemplate: CampaignMessageTemplate;
  stats: CampaignStats;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignInput {
  title: string;
  description?: string;
  type: CampaignType;
  discountType: DiscountType;
  discountValue: number;
  giftDescription?: string;
  promoCode?: string;
  validFrom: string;
  validUntil: string;
  status?: CampaignStatus;
  targetAudience: TargetAudience;
  channels: CampaignChannel[];
  messageTemplate: CampaignMessageTemplate;
}

export interface QuickBroadcastInput {
  segment: TargetAudience;
  channels: CampaignChannel[];
  title: string;
  message: string;
  promoCode?: string;
}
