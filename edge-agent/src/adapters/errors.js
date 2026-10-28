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
  // zkteco-js hataları Error'dan türemeyen ve birkaç kez iç içe sarılabilen
  // `{ err, command, ip }` nesneleridir.
  let source = err;
  for (let depth = 0; depth < 5 && source?.err; depth++) source = source.err;
  const message = source?.message ?? err?.message ?? String(source ?? err);
  const code = source?.code ?? err?.code ?? err?.cause?.code ?? '';
  const transient =
    source?.name === 'TimeoutError' ||
    source?.name === 'AbortError' ||
    /ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|fetch failed/i.test(
      `${message} ${code}`,
    );
  return new DeviceError(message, { transient, cause: err });
}

module.exports = { DeviceError, asDeviceError };
