'use strict';

/**
 * transient = true  → ağ / zaman aşımı gibi geçici hata. İş öğesi onaylanmaz;
 *                     MainApi kiralaması (60 sn) dolunca yeniden teslim edilir.
 * transient = false → cihaz komutu reddetti veya geri okuma eşleşmedi. MainApi'ye
 *                     `error` olarak bildirilir ve panelde görünür.
 */
class DeviceError extends Error {
  constructor(message, { transient = false, cause } = {}) {
    super(message, { cause });
    this.transient = transient;
  }
}

function asDeviceError(err) {
  if (err instanceof DeviceError) return err;
  const transient =
    err?.name === 'TimeoutError' ||
    err?.name === 'AbortError' ||
    /ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|fetch failed/i.test(
      `${err?.message} ${err?.cause?.code ?? ''}`,
    );
  return new DeviceError(err?.message ?? String(err), { transient, cause: err });
}

module.exports = { DeviceError, asDeviceError };
