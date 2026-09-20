import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AiAssistantService } from '../../../core/services/ai-assistant.service';
import { AdminMembersService } from '../../../admin/members/admin-members.service';
import { BranchContextService } from '../../../core/services/branch-context.service';

interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  time: string;
  actionLink?: string;
  actionLabel?: string;
}

@Component({
  selector: 'app-ai-assistant-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ai-assistant-modal.html',
  styleUrl: './ai-assistant-modal.scss',
})
export class AiAssistantModal {
  protected readonly aiService = inject(AiAssistantService);
  private readonly membersService = inject(AdminMembersService);
  protected readonly branchContext = inject(BranchContextService);

  readonly userInput = signal('');
  readonly isTyping = signal(false);

  readonly messages = signal<AiMessage[]>([
    {
      role: 'assistant',
      content:
        'Merhaba! Ben Odivon AI Salon Asistanınız. Üye devamsızlıkları, antrenman planlama, Uyumsoft e-fatura entegrasyonu veya salon doluluk analizi konularında size nasıl yardımcı olabilirim?',
      time: 'Şimdi',
    },
  ]);

  readonly quickPrompts = [
    {
      label: '⚠️ Yenileme Bekleyen Üyeler',
      query: 'Bu hafta üyeliği biten veya deneme süresi dolan üyeleri tespit et.',
    },
    {
      label: '📊 Salon Doluluk & Pik Saatler',
      query: 'Turnike verilerine göre salonun en yoğun ve en sakin saatlerini analiz et.',
    },
    {
      label: '🧾 Uyumsoft E-Fatura Durumu',
      query: 'Uyumsoft e-arşiv entegrasyonu ve son kesilen faturalar hakkında bilgi ver.',
    },
    {
      label: '🏋️‍♂️ Antrenman Programı Önerisi',
      query: 'Yeni başlayan bir üye için 3 günlük bölgesel fitness programı tavsiye et.',
    },
  ];

  close(): void {
    this.aiService.close();
  }

  sendQuick(query: string): void {
    this.userInput.set(query);
    this.sendMessage();
  }

  sendMessage(): void {
    const text = this.userInput().trim();
    if (!text || this.isTyping()) return;

    const userMsg: AiMessage = {
      role: 'user',
      content: text,
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    };

    this.messages.update((list) => [...list, userMsg]);
    this.userInput.set('');
    this.isTyping.set(true);

    // Akıllı GYM Asistanı Cevabı Simülasyonu
    setTimeout(() => {
      let reply = '';
      let actionLink: string | undefined;
      let actionLabel: string | undefined;

      const lower = text.toLowerCase();
      if (lower.includes('yenileme') || lower.includes('üye') || lower.includes('biten')) {
        reply =
          'Sistemdeki üye verileri tarandı: Aktif şubenizde süresi bitmek üzere olan üyeler tespit edildi. Bu üyelere otomatik WhatsApp yenileme linki gönderilebilir veya doğrudan Üye Yönetimi ekranından paket yenilemesi yapılabilir.';
        actionLink = '/admin/members';
        actionLabel = 'Üye Listesini Aç';
      } else if (lower.includes('doluluk') || lower.includes('saat') || lower.includes('turnike')) {
        reply =
          'Turnike loglarına göre salonunuzda en yoğun saatler hafta içi 18:30 - 21:00 arasıdır. Hafta sonu ise 11:00 - 15:00 arası dengeli bir katılım gözlemleniyor. Grup derslerini 19:30 seanslarına planlamak katılımı %35 artıracaktır.';
        actionLink = '/admin/overview';
        actionLabel = 'Canlı Radarı İncele';
      } else if (lower.includes('uyumsoft') || lower.includes('fatura') || lower.includes('muhasebe')) {
        reply =
          'Uyumsoft E-Fatura & E-Arşiv modülü: Satış yapılan market ürünleri veya üyelik paketleri için otomatik GİB e-arşiv faturası düzenlenebilir. Entegrasyon anahtarlarınızı Ön Muhasebe & E-Dönüşüm sekmesinden yönetebilirsiniz.';
        actionLink = '/admin/accounting';
        actionLabel = 'Ön Muhasebeye Git';
      } else if (lower.includes('antrenman') || lower.includes('fitness') || lower.includes('program')) {
        reply =
          'Yeni başlayan bir sporcu için "Göğüs & Ön Kol", "Sırt & Arka Kol" ve "Bacak & Omuz" olmak üzere 3 günlük itiş/çekiş split programı öneriyorum. Eğitim Sihirbazı üzerinden tek tıkla üyenin profiline kaydedebilirsiniz.';
        actionLink = '/admin/wizard';
        actionLabel = 'Eğitim Sihirbazını Aç';
      } else {
        reply =
          `"${text}" talebiniz değerlendirildi. OdivonGYM ERP sistemi, tüm şube operasyonlarınızı, antrenör seanslarınızı ve Uyumsoft mali süreçlerinizi merkezi olarak senkronize etmektedir.`;
      }

      this.messages.update((list) => [
        ...list,
        {
          role: 'assistant',
          content: reply,
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          actionLink,
          actionLabel,
        },
      ]);
      this.isTyping.set(false);
    }, 700);
  }
}
