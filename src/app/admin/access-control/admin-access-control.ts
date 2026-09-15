import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ComingSoon } from '../../shared/components/coming-soon/coming-soon';

@Component({
  selector: 'app-admin-access-control',
  standalone: true,
  imports: [PageHeader, ComingSoon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Turnike Sistemi"
      icon="nfc"
      description="QR/RFID ile turnike girişlerini izle, canlı giriş-çıkış kayıtlarını gör."
    />
    <app-coming-soon
      icon="nfc"
      title="Turnike entegrasyonu yakında burada"
      description="Bu modül fiziksel turnike/kart okuyucu donanımınla haberleşecek — hangi marka/protokolü (Wiegand, RFID kart, QR okuyucu vb.) kullandığını netleştirdiğimizde entegrasyona başlayabiliriz."
    />
  `,
})
export class AdminAccessControl {}
