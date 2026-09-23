import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon, SweetAlertOptions } from 'sweetalert2';

export interface AlertConfirmOptions {
  title?: string;
  message?: string;
  icon?: SweetAlertIcon;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
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
   * Genel yapılandırılabilir onay penceresi.
   */
  async confirm(options: AlertConfirmOptions): Promise<boolean> {
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
