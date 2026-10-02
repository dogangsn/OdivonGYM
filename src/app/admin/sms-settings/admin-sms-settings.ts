import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AlertService } from '../../core/services/alert.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SlideOver } from '../../shared/ui/slide-over';
import { Field } from '../../shared/ui/field';
import { SmsProviderType, SmsGatewayConfig } from '../../core/api/sms.api';
import { AdminSmsSettingsService } from './admin-sms-settings.service';

interface ProviderCardInfo {
  id: SmsProviderType;
  name: string;
  badge: string;
  description: string;
  protocol: string;
  icon: string;
}

const PROVIDERS: ProviderCardInfo[] = [
  {
    id: 'netgsm',
    name: 'Netgsm',
    badge: 'En Çok Tercih Edilen',
    description: "Türkiye'nin en yaygın kurumsal SMS operatörü. Başlıklı SMS, canlı bakiye sorgulama ve yüksek teslimat başarısı.",
    protocol: 'REST / XML API',
    icon: 'cell_tower',
  },
  {
    id: 'iletimerkezi',
    name: 'İletiMerkezi',
    badge: 'Hızlı REST API',
    description: 'Modern JSON REST API, otomatik Türkçe karakter dönüştürme ve milisaniyelik anlık kredi sorgulama.',
    protocol: 'JSON REST API (v1)',
    icon: 'send',
  },
  {
    id: 'mutlucell',
    name: 'Mutlucell',
    badge: 'Spor & Perakende',
    description: 'Spor kulüpleri ve perakende işletmeleri için tasarlanmış ekonomik ve stabil SMS ağ geçidi.',
    protocol: 'HTTP XML API',
    icon: 'sms',
  },
  {
    id: 'verimor',
    name: 'Verimor Telekom',
    badge: 'Telekom Altyapısı',
    description: 'Doğrudan telekom operatör altyapısı, yüksek TPS kapasitesi ve detaylı teslimat webhookları.',
    protocol: 'REST JSON (v2)',
    icon: 'hub',
  },
  {
    id: 'twilio',
    name: 'Twilio',
    badge: 'Global / Uluslararası',
    description: 'Yabancı pasaportlu üyeler, global telefon numaraları (+90, +49, +1 vb.) ve OTP doğrulamaları.',
    protocol: 'Global REST API',
    icon: 'public',
  },
  {
    id: 'simulator',
    name: 'Simülatör Modu',
    badge: 'Geliştirici / Test',
    description: 'Gerçek SMS kredisi harcamadan panel üzerinde test, otomasyon ve şablon denemesi yapma modu.',
    protocol: 'Yerel Bellek Simülasyonu',
    icon: 'developer_mode',
  },
];

import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';

@Component({
  selector: 'app-admin-sms-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    MatIconModule,
    MatTooltipModule,
    PageHeader,
    SlideOver,
    Field,
    DatePipe,
    DecimalPipe,
    UpperCasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-sms-settings.html',
})

export class AdminSmsSettings implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AdminSmsSettingsService);
  private readonly alertService = inject(AlertService);

  protected readonly providers = PROVIDERS;

  // Real-time backend configuration
  protected readonly config = toSignal(this.service.watchConfig(), { initialValue: null });

  // Current active provider computed
  protected readonly activeProvider = computed<SmsProviderType>(() => {
    return this.config()?.provider || 'simulator';
  });

  // UI State
  protected readonly editingProvider = signal<SmsProviderType>('netgsm');
  protected readonly drawerOpen = signal(false);
  protected readonly testDrawerOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly queryingBalance = signal(false);
  protected readonly sendingTest = signal(false);
  protected readonly showSecret = signal(false);

  // Quick Test Form
  protected testPhone = '';
  protected testMessage = 'OdivonGYM: SMS saglayici baglanti testi basariyla tamamlanmistir.';
  protected testHeader = '';

  // Configuration Form
  protected readonly form = this.fb.nonNullable.group({
    provider: ['netgsm' as SmsProviderType, [Validators.required]],
    isActive: [true],
    defaultHeader: ['ODIVON GYM'],

    // Netgsm
    netgsmUsercode: [''],
    netgsmPassword: [''],
    netgsmHeader: [''],

    // IletiMerkezi
    iletimerkeziApiKey: [''],
    iletimerkeziApiHash: [''],
    iletimerkeziSender: [''],

    // Mutlucell
    mutlucellUsername: [''],
    mutlucellPassword: [''],
    mutlucellOriginator: [''],

    // Verimor
    verimorUsername: [''],
    verimorPassword: [''],
    verimorHeader: [''],

    // Twilio
    twilioAccountSid: [''],
    twilioAuthToken: [''],
    twilioFromNumber: [''],
  });

  ngOnInit(): void {
    // Initial fetch
  }

  protected openConfigDrawer(provider: SmsProviderType): void {
    this.editingProvider.set(provider);
    this.showSecret.set(false);
    const cfg = this.config();

    this.form.patchValue({
      provider,
      isActive: cfg?.isActive ?? true,
      defaultHeader: cfg?.defaultHeader || 'ODIVON GYM',

      netgsmUsercode: cfg?.netgsm?.usercode || '',
      netgsmPassword: cfg?.netgsm?.password || '',
      netgsmHeader: cfg?.netgsm?.header || cfg?.defaultHeader || 'ODIVON GYM',

      iletimerkeziApiKey: cfg?.iletimerkezi?.apiKey || '',
      iletimerkeziApiHash: cfg?.iletimerkezi?.apiHash || '',
      iletimerkeziSender: cfg?.iletimerkezi?.sender || cfg?.defaultHeader || 'ODIVON GYM',

      mutlucellUsername: cfg?.mutlucell?.username || '',
      mutlucellPassword: cfg?.mutlucell?.password || '',
      mutlucellOriginator: cfg?.mutlucell?.originator || cfg?.defaultHeader || 'ODIVON GYM',

      verimorUsername: cfg?.verimor?.username || '',
      verimorPassword: cfg?.verimor?.password || '',
      verimorHeader: cfg?.verimor?.header || cfg?.defaultHeader || 'ODIVON GYM',

      twilioAccountSid: cfg?.twilio?.accountSid || '',
      twilioAuthToken: cfg?.twilio?.authToken || '',
      twilioFromNumber: cfg?.twilio?.fromNumber || '',
    });

    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  protected async saveConfig(): Promise<void> {
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      const payload: Partial<SmsGatewayConfig> = {
        provider: this.editingProvider(),
        isActive: v.isActive,
        defaultHeader: v.defaultHeader.trim(),
        netgsm: {
          usercode: v.netgsmUsercode.trim(),
          password: v.netgsmPassword.trim(),
          header: v.netgsmHeader.trim(),
        },
        iletimerkezi: {
          apiKey: v.iletimerkeziApiKey.trim(),
          apiHash: v.iletimerkeziApiHash.trim(),
          sender: v.iletimerkeziSender.trim(),
        },
        mutlucell: {
          username: v.mutlucellUsername.trim(),
          password: v.mutlucellPassword.trim(),
          originator: v.mutlucellOriginator.trim(),
        },
        verimor: {
          username: v.verimorUsername.trim(),
          password: v.verimorPassword.trim(),
          header: v.verimorHeader.trim(),
        },
        twilio: {
          accountSid: v.twilioAccountSid.trim(),
          authToken: v.twilioAuthToken.trim(),
          fromNumber: v.twilioFromNumber.trim(),
        },
      };

      await this.service.saveConfig(payload);
      this.alertService.toastSuccess('SMS sağlayıcı ayarları kaydedildi ve aktif edildi.');
      this.closeDrawer();

      // Automatically query balance to verify credentials
      if (this.editingProvider() !== 'simulator') {
        this.fetchBalance();
      }
    } catch {
      this.alertService.toastError('Ayarlar kaydedilemedi, lütfen bilgileri kontrol edin.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async fetchBalance(): Promise<void> {
    this.queryingBalance.set(true);
    try {
      const res = await this.service.queryBalance();
      if (res.success) {
        this.alertService.toastSuccess(res.message || `Bakiye güncellendi: ${res.balance} ${res.currency}`);
      } else {
        this.alertService.toastError(res.message || 'Bakiye sorgulanamadı.');
      }
    } catch {
      this.alertService.toastError('Operatörden bakiye yanıtı alınamadı.');
    } finally {
      this.queryingBalance.set(false);
    }
  }

  protected openTestDrawer(): void {
    const cfg = this.config();
    this.testHeader = cfg?.defaultHeader || 'ODIVON GYM';
    this.testDrawerOpen.set(true);
  }

  protected closeTestDrawer(): void {
    this.testDrawerOpen.set(false);
  }

  protected async sendTestSms(): Promise<void> {
    if (!this.testPhone.trim()) {
      this.alertService.toastError('Lütfen geçerli bir telefon numarası giriniz.');
      return;
    }
    this.sendingTest.set(true);
    try {
      const res = await this.service.sendTestSms(
        this.testPhone.trim(),
        this.testMessage.trim(),
        this.testHeader.trim() || undefined,
      );

      if (res.success) {
        this.alertService.toastSuccess(res.message || 'Test SMS başarıyla gönderildi.');
        this.closeTestDrawer();
      } else {
        this.alertService.toastError(res.message || 'Test SMS gönderimi başarısız oldu.');
      }
    } catch {
      this.alertService.toastError('Operatöre erişim sağlanamadı.');
    } finally {
      this.sendingTest.set(false);
    }
  }
}
