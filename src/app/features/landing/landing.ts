import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { LogoMark } from '../../shared/components/logo-mark/logo-mark';
import { SAAS_PLANS_CONFIG, SaasPlan } from '../../core/models/saas-plan.model';

interface LandingFeature {
  icon: string;
  title: string;
  text: string;
  tone: string;
}

interface LandingFaq {
  q: string;
  a: string;
}

/**
 * gym.odivon.com açılış (tanıtım) sayfası. Oturum açmış kullanıcı guestGuard ile
 * doğrudan panele gider. Paketler gösterilir ama fiyat gösterilmez: her paketin
 * düğmesi kayıt (14 günlük deneme) akışına, yani /auth/register'a çıkar.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, MatIconModule, LogoMark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  protected readonly year = new Date().getFullYear();
  protected readonly menuOpen = signal(false);
  protected readonly openFaq = signal<number | null>(0);

  protected readonly plans: SaasPlan[] = [
    SAAS_PLANS_CONFIG.starter,
    SAAS_PLANS_CONFIG.pro,
    SAAS_PLANS_CONFIG.enterprise,
  ];

  protected readonly features: LandingFeature[] = [
    {
      icon: 'badge',
      title: 'Üye ve üyelik yönetimi',
      text: 'Kayıt, paket, dondurma, uzatma ve üye geçmişi tek ekranda. Biten üyelikleri sistem kendisi işaretler.',
      tone: 'indigo',
    },
    {
      icon: 'sensor_door',
      title: 'Turnike ve kart geçişi',
      text: 'Edge Agent salonunuzdaki turnikeye bağlanır. Üyeliği biten üye kapıdan geçemez, her geçiş anında panele düşer.',
      tone: 'emerald',
    },
    {
      icon: 'credit_card',
      title: 'Online ödeme ve tahsilat',
      text: 'Üyeleriniz paketini kartla alır, cüzdanına para yükler, borcunu öder. Para doğrudan salonunuzun hesabına geçer.',
      tone: 'sky',
    },
    {
      icon: 'request_quote',
      title: 'Taksit, borç ve kasa',
      text: 'Parçalı ödemeler, alacak takibi, gelir gider ve günlük kasa. Kim ne kadar borçlu, bir bakışta görün.',
      tone: 'amber',
    },
    {
      icon: 'insights',
      title: 'Raporlar ve analiz',
      text: 'Ciro, aktif üye, kayıp riski olan üyeler ve dönüşüm hunisi. Kararlarınızı tahminle değil veriyle verin.',
      tone: 'purple',
    },
    {
      icon: 'event_available',
      title: 'Grup dersleri ve PT randevuları',
      text: 'Ders takvimi, kontenjan ve antrenör randevuları. Üye yerini kendi telefonundan ayırtır.',
      tone: 'rose',
    },
    {
      icon: 'campaign',
      title: 'Hatırlatma ve kampanyalar',
      text: 'Üyelik bitişi yaklaşanlara otomatik hatırlatma, arkadaşını getir kampanyaları ve geri kazanım listeleri.',
      tone: 'indigo',
    },
    {
      icon: 'admin_panel_settings',
      title: 'Personel, rol ve şubeler',
      text: 'Yönetici, resepsiyon ve antrenör yetkileri ayrı. Birden fazla şubeyi tek hesaptan yönetin, her işlem kayıt altında.',
      tone: 'emerald',
    },
  ];

  protected readonly faqs: LandingFaq[] = [
    {
      q: 'Demo hesap ücretli mi?',
      a: 'Hayır. Demo hesap oluşturduğunuzda salonunuz 14 gün boyunca tüm özelliklerle açılır, kart bilgisi istenmez. Süre bitince dilediğiniz paketle devam edersiniz.',
    },
    {
      q: 'Paket fiyatlarını nereden öğrenirim?',
      a: 'Fiyatlar salonunuzun büyüklüğüne ve şube sayısına göre değişir. Demo hesabınızı açtıktan sonra panelde güncel teklifleri görebilir, bizimle de görüşebilirsiniz.',
    },
    {
      q: 'Mevcut turnikemle çalışır mı?',
      a: 'Edge Agent, salondaki bir Windows bilgisayara kurulur ve yaygın kartlı ve QR’lı turnikelerle konuşur. Cihazınızı kurulumda birlikte tanımlıyoruz.',
    },
    {
      q: 'Üyelerim de sistemi kullanabilir mi?',
      a: 'Evet. Üyeler kendi hesaplarıyla girip paketini, ders randevusunu, ölçümlerini ve antrenman programını görür, online ödeme yapar.',
    },
    {
      q: 'Verilerim güvende mi?',
      a: 'Her salonun verisi ayrı tutulur, personel yalnızca yetkisi olan ekranları görür ve kritik işlemler denetim kaydına yazılır. KVKK aydınlatma metnimiz gizlilik sayfasındadır.',
    },
  ];

  protected readonly toneClass: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300',
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300',
  };

  toggleFaq(index: number): void {
    this.openFaq.update((current) => (current === index ? null : index));
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  /** Ekran görüntüsü yüklenemezse kırık resim yerine boş, markalı bir çerçeve kalsın. */
  onShotError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    img.parentElement?.classList.add('landing-shot--empty');
  }
}
