import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon, SweetAlertOptions } from 'sweetalert2';

export interface AlertConfirmOptions {
  title?: string;
  message?: string;
  icon?: SweetAlertIcon;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  variant?: 'primary' | 'danger' | 'warning' | 'blue' | 'archive';
}

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  private readonly modalMixin = Swal.mixin({
    heightAuto: false,
    scrollbarPadding: false,
  });

  private readonly toastMixin = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    backdrop: false,
    didOpen: (toast) => {
      toast.onmouseenter = Swal.stopTimer;
      toast.onmouseleave = Swal.resumeTimer;
    },
  });

  /**
   * Silme ve kritik geri alınamaz işlemler için kırmızı vurgulu onay penceresi.
   */
  async deleteConfirm(itemName: string, customMessage?: string): Promise<boolean> {
    const result = await this.modalMixin.fire({
      title: 'Silmek İstediğinize Emin Misiniz?',
      html:
        customMessage ??
        `<strong>"${itemName}"</strong> kaydı silinecektir. Bu işlem geri alınamaz.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Evet, Sil',
      cancelButtonText: 'Vazgeç',
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        confirmButton: 'swal2-confirm odivon-btn-danger',
        cancelButton: 'swal2-cancel odivon-btn-cancel',
      },
    });

    return !!result.isConfirmed;
  }

  /**
   * Arşivleme ve arşivden çıkarma işlemleri için özel onay penceresi.
   * Silme işlemi olmadığı için kullanıcıyı yanıltmaz.
   */
  async archiveConfirm(
    itemName: string,
    isArchiving = true,
    customMessage?: string,
  ): Promise<boolean> {
    const title = isArchiving
      ? 'Arşive Kaldırmak İstediğinize Emin Misiniz?'
      : 'Arşivden Çıkarmak İstediğinize Emin Misiniz?';

    const confirmText = isArchiving ? 'Evet, Arşive Kaldır' : 'Evet, Aktifleştir';

    const defaultMsg = isArchiving
      ? `<strong>"${itemName}"</strong> adlı üyeyi arşive kaldırmak istediğinize emin misiniz?<br><br><span class="text-xs text-slate-500 dark:text-slate-400">Arşivlenen üyeler aktif üye listesinde ve otomatik geçişlerde gizlenir, ancak geçmiş verileri, paketleri ve bakiye hareketleri korunur.</span>`
      : `<strong>"${itemName}"</strong> adlı üyeyi arşivden çıkarıp tekrar aktif üye listesine almak istediğinize emin misiniz?`;

    const result = await this.modalMixin.fire({
      title,
      html: customMessage ?? defaultMsg,
      icon: isArchiving ? 'question' : 'info',
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Vazgeç',
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        confirmButton: isArchiving
          ? 'swal2-confirm odivon-btn-archive'
          : 'swal2-confirm odivon-btn-primary',
        cancelButton: 'swal2-cancel odivon-btn-cancel',
      },
    });

    return !!result.isConfirmed;
  }

  /**
   * Özel eylem onay penceresi (Randevu iptali, Acil durum modu, Satış iadesi vb.).
   */
  async actionConfirm(
    title: string,
    message: string,
    confirmText = 'Onayla',
    icon: SweetAlertIcon = 'question',
    isDestructive = false,
  ): Promise<boolean> {
    const result = await this.modalMixin.fire({
      title,
      html: message,
      icon,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Vazgeç',
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        confirmButton: isDestructive
          ? 'swal2-confirm odivon-btn-danger'
          : 'swal2-confirm odivon-btn-primary',
        cancelButton: 'swal2-cancel odivon-btn-cancel',
      },
    });

    return !!result.isConfirmed;
  }

  /**
   * Formu kaydetmeden çıkış için özel, modern mavi temalı onay penceresi.
   * Kırmızı silme uyarısı yerine nazik mavi buton ve modern çıkış ikonu kullanır.
   */
  async discardConfirm(customMessage?: string, title?: string): Promise<boolean> {
    const exitIconSvg = `
      <div class="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/15 mx-auto">
        <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      </div>
    `;

    const htmlContent =
      customMessage ??
      '<div class="mt-1 space-y-1"><p class="text-sm font-semibold text-slate-700 dark:text-slate-200 m-0">Girdiğiniz bilgiler kaydedilmeyecektir.</p><p class="text-xs text-slate-400 dark:text-slate-400 m-0">Sayfadan veya formdan çıkmak istediğinize emin misiniz?</p></div>';

    const result = await this.modalMixin.fire({
      title: title ?? 'Kaydetmeden Çıkmak İstiyor Musunuz?',
      html: htmlContent,
      iconHtml: exitIconSvg,
      showCancelButton: true,
      confirmButtonText: 'Evet, Çık',
      cancelButtonText: 'Vazgeç',
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        popup: 'odivon-swal-discard-popup',
        icon: 'odivon-swal-custom-icon',
        confirmButton: 'swal2-confirm odivon-btn-blue',
        cancelButton: 'swal2-cancel odivon-btn-cancel',
      },
    });

    return !!result.isConfirmed;
  }

  /**
   * Genel yapılandırılabilir onay penceresi.
   */
  async confirm(options: AlertConfirmOptions): Promise<boolean> {
    const titleLower = (options.title ?? '').toLowerCase();
    const isDiscard =
      titleLower.includes('kaydetmeden') ||
      titleLower.includes('çıkmak') ||
      options.variant === 'blue';

    if (isDiscard) {
      return this.discardConfirm(options.message, options.title);
    }

    const result = await this.modalMixin.fire({
      title: options.title ?? 'Onaylıyor musunuz?',
      html: options.message,
      icon: options.icon ?? 'question',
      showCancelButton: true,
      confirmButtonText: options.confirmText ?? 'Evet',
      cancelButtonText: options.cancelText ?? 'Vazgeç',
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        confirmButton: options.isDestructive
          ? 'swal2-confirm odivon-btn-danger'
          : options.variant === 'archive'
            ? 'swal2-confirm odivon-btn-archive'
            : options.variant === 'blue'
              ? 'swal2-confirm odivon-btn-blue'
              : 'swal2-confirm odivon-btn-primary',
        cancelButton: 'swal2-cancel odivon-btn-cancel',
      },
    });

    return !!result.isConfirmed;
  }

  /**
   * Başarılı işlem modalı.
   */
  async success(title: string, message?: string): Promise<void> {
    await this.modalMixin.fire({
      title,
      html: message,
      icon: 'success',
      confirmButtonText: 'Tamam',
      buttonsStyling: false,
      customClass: {
        confirmButton: 'swal2-confirm odivon-btn-primary',
      },
    });
  }

  /**
   * Hata modalı (browser alert yerine).
   */
  async error(title: string, message?: string): Promise<void> {
    await this.modalMixin.fire({
      title,
      html: message,
      icon: 'error',
      confirmButtonText: 'Tamam',
      buttonsStyling: false,
      customClass: {
        confirmButton: 'swal2-confirm odivon-btn-primary',
      },
    });
  }

  /**
   * Uyarı modalı.
   */
  async warning(title: string, message?: string): Promise<void> {
    await this.modalMixin.fire({
      title,
      html: message,
      icon: 'warning',
      confirmButtonText: 'Tamam',
      buttonsStyling: false,
      customClass: {
        confirmButton: 'swal2-confirm odivon-btn-primary',
      },
    });
  }

  /**
   * Bilgilendirme modalı.
   */
  async info(title: string, message?: string): Promise<void> {
    await this.modalMixin.fire({
      title,
      html: message,
      icon: 'info',
      confirmButtonText: 'Tamam',
      buttonsStyling: false,
      customClass: {
        confirmButton: 'swal2-confirm odivon-btn-primary',
      },
    });
  }

  /**
   * Ham SweetAlert seçenekleri ile modal açma.
   */
  async fire(options: SweetAlertOptions): Promise<any> {
    return this.modalMixin.fire(options);
  }

  // ==========================================
  // TOAST BİLDİRİMLERİ (Ekranın sağ üstünde yüzen bildirimler)
  // ==========================================

  toastSuccess(message: string, title?: string): void {
    this.toastMixin.fire({
      icon: 'success',
      title: title ?? message,
      text: title ? message : undefined,
    });
  }

  toastError(message: string, title?: string): void {
    this.toastMixin.fire({
      icon: 'error',
      title: title ?? message,
      text: title ? message : undefined,
    });
  }

  toastWarning(message: string, title?: string): void {
    this.toastMixin.fire({
      icon: 'warning',
      title: title ?? message,
      text: title ? message : undefined,
    });
  }

  toastInfo(message: string, title?: string): void {
    this.toastMixin.fire({
      icon: 'info',
      title: title ?? message,
      text: title ? message : undefined,
    });
  }
}
