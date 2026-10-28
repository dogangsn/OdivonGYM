export interface GymMailTemplate {
  id?: string;
  tenantId?: string;
  enabled: boolean;
  subject: string;
  heading: string;
  customMessage?: string;
  includeCredentials: boolean;
  includeQrCodeInfo: boolean;
  mobileAppUrl?: string;
  updatedAt?: string;
}

export const DEFAULT_MEMBER_MAIL_TEMPLATE: GymMailTemplate = {
  enabled: true,
  subject: '{{tenantName}} Ailesine Hoş Geldiniz! Giriş ve Turnike QR Kodunuz',
  heading: 'Aramıza Hoş Geldiniz! 🏋️‍♂️',
  customMessage:
    'Kulübümüze üyeliğiniz başarıyla tamamlanmıştır. Salonumuza giriş yaparken turnikelerdeki temassız QR geçiş sistemini kullanabilir veya mobil uygulamamız üzerinden randevu ve antrenmanlarınızı takip edebilirsiniz.',
  includeCredentials: true,
  includeQrCodeInfo: true,
  mobileAppUrl: '',
};

export interface MailTemplateVariable {
  key: string;
  label: string;
  description: string;
  example: string;
}

export const MAIL_TEMPLATE_VARIABLES: MailTemplateVariable[] = [
  { key: '{{memberName}}', label: 'Üye Adı Soyadı', description: 'Kayıt olan üyenin tam adı', example: 'Ahmet Yılmaz' },
  { key: '{{tenantName}}', label: 'Kulüp / Salon Adı', description: 'Üye olunan spor salonunun adı', example: 'Odivon GYM Fitness' },
  { key: '{{email}}', label: 'E-Posta Adresi', description: 'Üyenin kayıtlı e-posta adresi', example: 'ahmet@example.com' },
  { key: '{{password}}', label: 'Giriş Şifresi', description: 'Üyeye tanımlanan ilk giriş şifresi', example: '123456' },
  { key: '{{memberNumber}}', label: 'Üye Numarası', description: 'Turnike ve üye kart numarası', example: 'MEM-00124' },
  { key: '{{appUrl}}', label: 'Mobil Uygulama Linki', description: 'Mobil uygulama indirme/erişim bağlantısı', example: 'https://app.odivongym.com' },
  { key: '{{loginUrl}}', label: 'Giriş Ekranı Linki', description: 'Web/Mobil üye giriş portalı linki', example: 'https://odivon.com/login' },
];
