'use strict';

const { DeviceError } = require('./errors');

/** Henüz doğrulanmamış protokoller: hiçbir şeyi cihaza yazmaz, sessizce başarı da bildirmez. */
function createUnsupportedAdapter(device, reason) {
  return {
    protocol: device.protocol,
    async ping() {
      throw new DeviceError(reason);
    },
    async readEvents(cursor) {
      return { events: [], cursor };
    },
    async applyUser() {
      throw new DeviceError(reason);
    },
    close() {},
  };
}

module.exports = { createUnsupportedAdapter };
