import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { toSignal } from '@angular/core/rxjs-interop';

import { AdminCampaignsService } from './admin-campaigns.service';
import {
  Campaign,
  CampaignChannel,
  CampaignStatus,
  CampaignType,
  CreateCampaignInput,
  DiscountType,
  QuickBroadcastInput,
  TargetAudience,
} from '../../core/models/campaign.model';
import { AdminMembersService } from '../members/admin-members.service';
import { PermissionService } from '../../core/services/permission.service';

import { RouterLink } from '@angular/router';
import { SaasSubscriptionService } from '../../core/services/saas-subscription.service';

type ActiveTab = 'campaigns' | 'quickBroadcast' | 'retentionRadar';

@Component({
  selector: 'app-admin-campaigns',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule, MatMenuModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-campaigns.html',
  styleUrl: './admin-campaigns.scss',
})
export class AdminCampaigns {
  private readonly campaignsService = inject(AdminCampaignsService);
  protected readonly membersService = inject(AdminMembersService);
  protected readonly permissions = inject(PermissionService);
  protected readonly saasSub = inject(SaasSubscriptionService);

  readonly campaigns = toSignal(this.campaignsService.watchCampaigns(), { initialValue: [] });
  readonly membersList = toSignal(this.membersService.watchMembers(), { initialValue: [] });

  readonly activeTab = signal<ActiveTab>('campaigns');
  readonly searchTerm = signal('');
  readonly selectedType = signal<CampaignType | 'all'>('all');
  readonly selectedStatus = signal<CampaignStatus | 'all'>('all');

  readonly isDrawerOpen = signal(false);
  readonly editingCampaign = signal<Campaign | null>(null);
  readonly isSaving = signal(false);

  // Dispatch Modal State
  readonly dispatchingCampaign = signal<Campaign | null>(null);
  readonly isDispatching = signal(false);
  readonly dispatchSuccessMessage = signal<string | null>(null);

  // Quick Broadcast Form State
  quickBroadcastData = {
    segment: 'expiring_soon' as TargetAudience,
    channels: ['in_app', 'whatsapp'] as CampaignChannel[],
    title: 'Üyelik Süresi Yenileme Hatırlatması',
    message: 'Sevgili üyemiz, OdivonGYM üyeliğinizin bitmesine az bir zaman kaldı. Spor temponuzu kaybetmemek için hemen yenileyin, özel avantajlardan faydalanın!',
    promoCode: 'YENILE2026',
  };
  readonly isBroadcasting = signal(false);
  readonly broadcastSuccessMessage = signal<string | null>(null);

  // Form State
  formData = {
    title: '',
    description: '',
    type: 'discount' as CampaignType,
    discountType: 'percentage' as DiscountType,
    discountValue: 20,
    giftDescription: '',
    promoCode: '',
    validFrom: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    status: 'active' as CampaignStatus,
    targetAudience: 'all_members' as TargetAudience,
    channels: ['in_app', 'sms'] as CampaignChannel[],
    inAppTitle: '',
    inAppBody: '',
    smsBody: '',
    whatsappBody: '',
    emailSubject: '',
    emailBody: '',
  };

  // KPIs
  readonly totalCampaigns = computed(() => this.campaigns().length);
  readonly activeCampaigns = computed(
    () => this.campaigns().filter((c) => c.status === 'active').length,
  );
  readonly totalReached = computed(() =>
    this.campaigns().reduce((acc, c) => acc + (c.stats?.sentCount || 0), 0),
  );
  readonly totalRevenueGenerated = computed(() =>
    this.campaigns().reduce((acc, c) => acc + (c.stats?.revenueGenerated || 0), 0),
  );
  readonly overallConversionRate = computed(() => {
    const totalSent = this.totalReached();
    const totalConverted = this.campaigns().reduce(
      (acc, c) => acc + (c.stats?.convertedCount || 0),
      0,
    );
    if (!totalSent) return 0;
    return Math.round((totalConverted / totalSent) * 100);
  });

  // Filtered Campaigns
  readonly filteredCampaigns = computed(() => {
    const list = this.campaigns();
    const search = this.searchTerm().trim().toLowerCase();
    const type = this.selectedType();
    const status = this.selectedStatus();

    return list.filter((item) => {
      const matchType = type === 'all' || item.type === type;
      const matchStatus = status === 'all' || item.status === status;
      const matchSearch =
        !search ||
        item.title.toLowerCase().includes(search) ||
        (item.promoCode && item.promoCode.toLowerCase().includes(search)) ||
        (item.description && item.description.toLowerCase().includes(search));

      return matchType && matchStatus && matchSearch;
    });
  });

  // Retention Radar Segments
  readonly expiringMembers = computed(() => {
    const list = this.membersList();
    const now = Date.now();
    const sevenDaysFromNow = now + 7 * 86400000;
    return list
      .filter((m) => {
        if (!m.membershipEndsAt) return false;
        const endMillis = m.membershipEndsAt.toMillis();
        return endMillis >= now && endMillis <= sevenDaysFromNow;
      })
      .slice(0, 10);
  });

  readonly trialMembers = computed(() => {
    const list = this.membersList();
    return list.filter((m) => m.membershipStatus === 'trial').slice(0, 10);
  });

  // Drawer Controls
  openNewCampaignDrawer(): void {
    this.editingCampaign.set(null);
    this.formData = {
      title: '',
      description: '',
      type: 'discount',
      discountType: 'percentage',
      discountValue: 20,
      giftDescription: '',
      promoCode: 'ODIVON20',
      validFrom: new Date().toISOString().slice(0, 10),
      validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      status: 'active',
      targetAudience: 'all_members',
      channels: ['in_app', 'sms', 'whatsapp'],
      inAppTitle: '🔥 Özel İndirim Fırsatı!',
      inAppBody: 'Sezonluk paket yenilemelerinde %20 indirim sizi bekliyor.',
      smsBody: 'OdivonGYM: Ozel sezonluk %20 indirim firsati! ODIVON20 kodu ile salonumuzda.',
      whatsappBody: 'Merhaba! 🏋️‍♂️ OdivonGYM özel %20 indirim fırsatından faydalanmak için hemen bize yazabilirsiniz.',
      emailSubject: 'OdivonGYM · Size Özel İndirim Fırsatı',
      emailBody: 'Sevgili üyemiz, sizin için hazırladığımız özel indirim fırsatını kaçırmayın.',
    };
    this.isDrawerOpen.set(true);
  }

  editCampaign(campaign: Campaign): void {
    this.editingCampaign.set(campaign);
    this.formData = {
      title: campaign.title,
      description: campaign.description,
      type: campaign.type,
      discountType: campaign.discountType,
      discountValue: campaign.discountValue,
      giftDescription: campaign.giftDescription || '',
      promoCode: campaign.promoCode || '',
      validFrom: campaign.validFrom,
      validUntil: campaign.validUntil,
      status: campaign.status,
      targetAudience: campaign.targetAudience,
      channels: [...campaign.channels],
      inAppTitle: campaign.messageTemplate?.inAppTitle || '',
      inAppBody: campaign.messageTemplate?.inAppBody || '',
      smsBody: campaign.messageTemplate?.smsBody || '',
      whatsappBody: campaign.messageTemplate?.whatsappBody || '',
      emailSubject: campaign.messageTemplate?.emailSubject || '',
      emailBody: campaign.messageTemplate?.emailBody || '',
    };
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
    this.editingCampaign.set(null);
  }

  toggleChannel(ch: CampaignChannel): void {
    const idx = this.formData.channels.indexOf(ch);
    if (idx >= 0) {
      this.formData.channels = this.formData.channels.filter((c) => c !== ch);
    } else {
      this.formData.channels = [...this.formData.channels, ch];
    }
  }

  toggleBroadcastChannel(ch: CampaignChannel): void {
    const idx = this.quickBroadcastData.channels.indexOf(ch);
    if (idx >= 0) {
      this.quickBroadcastData.channels = this.quickBroadcastData.channels.filter((c) => c !== ch);
    } else {
      this.quickBroadcastData.channels = [...this.quickBroadcastData.channels, ch];
    }
  }

  async saveCampaign(): Promise<void> {
    if (!this.formData.title.trim()) return;

    this.isSaving.set(true);
    try {
      const payload: CreateCampaignInput = {
        title: this.formData.title.trim(),
        description: this.formData.description.trim(),
        type: this.formData.type,
        discountType: this.formData.discountType,
        discountValue: Number(this.formData.discountValue) || 0,
        giftDescription: this.formData.giftDescription.trim(),
        promoCode: this.formData.promoCode.trim().toUpperCase(),
        validFrom: this.formData.validFrom,
        validUntil: this.formData.validUntil,
        status: this.formData.status,
        targetAudience: this.formData.targetAudience,
        channels: this.formData.channels,
        messageTemplate: {
          inAppTitle: this.formData.inAppTitle.trim(),
          inAppBody: this.formData.inAppBody.trim(),
          smsBody: this.formData.smsBody.trim(),
          whatsappBody: this.formData.whatsappBody.trim(),
          emailSubject: this.formData.emailSubject.trim(),
          emailBody: this.formData.emailBody.trim(),
        },
      };

      const current = this.editingCampaign();
      if (current) {
        await this.campaignsService.updateCampaign(current.id, payload);
      } else {
        await this.campaignsService.createCampaign(payload);
      }

      this.closeDrawer();
    } catch (err) {
      console.error('Kampanya kaydedilirken hata:', err);
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteCampaign(campaign: Campaign): Promise<void> {
    if (confirm(`"${campaign.title}" kampanyasını silmek istediğinize emin misiniz?`)) {
      await this.campaignsService.deleteCampaign(campaign.id);
    }
  }

  async toggleStatus(campaign: Campaign): Promise<void> {
    await this.campaignsService.toggleStatus(campaign.id, campaign.status);
  }

  // Dispatch Actions
  openDispatchModal(campaign: Campaign): void {
    this.dispatchingCampaign.set(campaign);
    this.dispatchSuccessMessage.set(null);
  }

  closeDispatchModal(): void {
    this.dispatchingCampaign.set(null);
    this.dispatchSuccessMessage.set(null);
  }

  async dispatchCampaignChannel(channel: CampaignChannel): Promise<void> {
    const campaign = this.dispatchingCampaign();
    if (!campaign) return;

    this.isDispatching.set(true);
    try {
      const res = await this.campaignsService.dispatchCampaign(campaign, channel);
      const channelNames: Record<CampaignChannel, string> = {
        in_app: 'Uygulama İçi Bildirim',
        sms: 'SMS',
        whatsapp: 'WhatsApp',
        email: 'E-Posta',
      };
      this.dispatchSuccessMessage.set(
        `${channelNames[channel]} üzerinden ${res.sentCount} üyeye kampanya başarıyla iletildi! 🎉`,
      );
    } catch (err) {
      console.error('Gönderim hatası:', err);
    } finally {
      this.isDispatching.set(false);
    }
  }

  // Quick Broadcast Action
  async sendBroadcast(): Promise<void> {
    if (!this.quickBroadcastData.title.trim() || !this.quickBroadcastData.message.trim()) return;

    this.isBroadcasting.set(true);
    try {
      const res = await this.campaignsService.sendQuickBroadcast(this.quickBroadcastData);
      this.broadcastSuccessMessage.set(
        `Toplu mesajınız seçilen segmentteki ${res.recipientCount} üyeye başarıyla kuyruğa alındı ve gönderildi! 🚀`,
      );
      setTimeout(() => this.broadcastSuccessMessage.set(null), 5000);
    } catch (err) {
      console.error('Toplu yayın hatası:', err);
    } finally {
      this.isBroadcasting.set(false);
    }
  }

  // One-click WhatsApp Direct Action
  sendWhatsAppDirect(phone?: string, memberName?: string): void {
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    const text = encodeURIComponent(
      `Merhaba ${memberName || 'Değerli Üyemiz'}! 👋 OdivonGYM üyeliğiniz hakkında size özel bir teklifimiz var. Bilgi almak için bize yazabilirsiniz!`,
    );
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`;
    window.open(url, '_blank');
  }

  getAudienceLabel(audience: TargetAudience): string {
    switch (audience) {
      case 'all_members':
        return 'Tüm Üyeler';
      case 'expiring_soon':
        return 'Süresi Yakında Bitenler';
      case 'trial_members':
        return 'Deneme Süresindekiler';
      case 'inactive_members':
        return '30 Gündür Gelmeyenler';
      case 'active_members':
        return 'Aktif Sporcular';
      default:
        return 'Hedef Kitle';
    }
  }

  getTypeLabel(type: CampaignType): string {
    switch (type) {
      case 'discount':
        return 'Özel İndirim';
      case 'referral':
        return 'Arkadaşını Getir';
      case 'retention':
        return 'Geri Kazanım';
      case 'gift':
        return 'Hediye Seans / Bar';
      case 'event':
        return 'Etkinlik';
      default:
        return 'Kampanya';
    }
  }
}
