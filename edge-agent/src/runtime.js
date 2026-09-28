'use strict';

/**
 * Agent çalışma döngüsü.
 *
 *  - Her `pollIntervalMs`'de: MainApi'den iş + cihaz listesi alınır, iş öğeleri
 *    cihazlara uygulanır, cihaz logları okunup yerel kuyruğa alınır, kuyruk
 *    MainApi'ye toplu gönderilir.
 *  - Her `heartbeatIntervalMs`'de: cihaz erişilebilirliği MainApi'ye bildirilir.
 *
 * MainApi'ye ulaşılamazsa son bilinen cihaz listesiyle log okumaya devam edilir;
 * olaylar SQLite kuyruğunda bekler.
 */

const { createAdapter } = require('./adapters');
const { asDeviceError } = require('./adapters/errors');

const EVENT_BATCH_SIZE = 500;

class AgentRuntime {
  constructor({ client, store, credentials = {}, logger = console, agentVersion, adapterFactory = createAdapter }) {
    this.client = client;
    this.store = store;
    this.credentials = credentials;
    this.log = logger;
    this.agentVersion = agentVersion;
    this.adapterFactory = adapterFactory;
    this.devices = new Map(); // gateId → { config, adapter, reachable, lastError, lastEventAt, deviceTime, lock }
    this.stopped = false;
    this.revoked = false;
    this.setDevices(store.loadDevices());
  }

  setDevices(configs) {
    const next = new Map();
    for (const config of configs) {
      const prev = this.devices.get(config.gateId);
      const unchanged =
        prev &&
        prev.config.protocol === config.protocol &&
        prev.config.host === config.host &&
        prev.config.port === config.port;
      if (unchanged) {
        prev.config = config;
        next.set(config.gateId, prev);
        continue;
      }
      prev?.adapter.close();
      next.set(config.gateId, {
        config,
        adapter: this.adapterFactory(config, this.credentials[config.host]),
        reachable: false,
        lastError: null,
        lastEventAt: null,
        deviceTime: null,
        lock: Promise.resolve(),
      });
    }
    for (const [gateId, device] of this.devices) {
      if (!next.has(gateId)) device.adapter.close();
    }
    this.devices = next;
  }

  /** Aynı cihaza eşzamanlı istek gitmesin diye cihaz başına sıralı çalıştırır. */
  withDevice(device, fn) {
    const run = device.lock.then(fn, fn);
    device.lock = run.catch(() => undefined);
    return run;
  }

  async tick() {
    if (this.revoked) return;
    let items = [];
    try {
      const work = await this.client.getWork();
      this.setDevices(work.devices ?? []);
      this.store.saveDevices(work.devices ?? []);
      items = work.items ?? [];
    } catch (err) {
      if (this.handleAuthError(err)) return;
      this.log.warn(`⚠️ MainApi'ye ulaşılamadı (iş alınamadı): ${err.message}`);
    }

    await Promise.all([...this.devices.values()].map((device) => this.pollDevice(device, items)));
    await this.flushEvents();
  }

  async pollDevice(device, allItems) {
    const items = allItems.filter((item) => item.gateId === device.config.gateId);
    await this.withDevice(device, async () => {
      for (const item of items) await this.applyItem(device, item);
      if (device.config.capabilities?.events) await this.readEvents(device);
    });
  }

  async applyItem(device, item) {
    const label = `${item.name || item.userId} (${device.config.name}, v${item.version})`;
    let ack;
    try {
      const { verified } = await device.adapter.applyUser(item);
      this.markReachable(device);
      ack = verified
        ? { version: item.version, result: 'applied', verified: true }
        : { version: item.version, result: 'error', verified: false, error: 'Cihazdan geri okuma doğrulanamadı.' };
    } catch (raw) {
      const err = asDeviceError(raw);
      if (err.transient) {
        // Onaylanmaz: MainApi kiralaması dolunca öğe yeniden teslim edilir.
        this.markUnreachable(device, err);
        this.log.warn(`⏳ Cihaza ulaşılamadı, tekrar denenecek (${label}): ${err.message}`);
        return;
      }
      this.markReachable(device);
      ack = { version: item.version, result: 'error', verified: false, error: err.message.slice(0, 500) };
    }

    try {
      await this.client.ack(item.id, ack);
    } catch (err) {
      if (this.handleAuthError(err)) return;
      // Cihaz işlemi idempotent; kiralama dolunca öğe tekrar gelir ve yeniden onaylanır.
      this.log.warn(`⚠️ Onay gönderilemedi (${label}): ${err.message}`);
      return;
    }
    if (ack.result === 'applied') {
      this.log.info(`✅ ${item.enabled ? 'Yetki güncellendi' : 'Yetki kaldırıldı'}: ${label}`);
    } else {
      this.log.error(`❌ Cihaz işlemi başarısız (${label}): ${ack.error}`);
    }
  }

  async readEvents(device) {
    const gateId = device.config.gateId;
    try {
      const cursor = this.store.getCursor(gateId);
      const { events, cursor: nextCursor, deviceTime } = await device.adapter.readEvents(cursor);
      this.markReachable(device);
      if (deviceTime) device.deviceTime = deviceTime;
      const added = this.store.enqueueEvents(gateId, events, nextCursor);
      if (events.length > 0) device.lastEventAt = events[events.length - 1].time;
      if (added > 0) this.log.info(`📥 ${device.config.name}: ${added} yeni geçiş kaydı kuyruğa alındı.`);
    } catch (raw) {
      const err = asDeviceError(raw);
      this.markUnreachable(device, err);
      this.log.warn(`⚠️ ${device.config.name} logları okunamadı: ${err.message}`);
    }
  }

  async flushEvents() {
    for (;;) {
      const batch = this.store.peekEvents(EVENT_BATCH_SIZE);
      if (batch.length === 0) return;
      try {
        const result = await this.client.sendEvents(batch.map((row) => row.event));
        // Reddedilenler de silinir: sunucu kalıcı olarak kabul etmiyor (ör. cihaz agent'tan alındı).
        for (const rejected of result?.rejected ?? []) {
          this.log.warn(`⚠️ Olay reddedildi (${rejected.eventId}): ${rejected.reason}`);
        }
        this.store.deleteEvents(batch.map((row) => row.rowId));
      } catch (err) {
        if (this.handleAuthError(err)) return;
        this.log.warn(`⚠️ Olaylar gönderilemedi, kuyrukta bekliyor (${this.store.queueDepth()}): ${err.message}`);
        return;
      }
      if (batch.length < EVENT_BATCH_SIZE) return;
    }
  }

  async heartbeat() {
    if (this.revoked) return;
    const devices = [...this.devices.values()];
    // Olay okumayan cihazlar (ör. yalnızca kullanıcı senkronu) için erişilebilirliği ping ile ölç.
    await Promise.all(
      devices
        .filter((device) => !device.config.capabilities?.events)
        .map((device) =>
          this.withDevice(device, async () => {
            try {
              const { deviceTime } = (await device.adapter.ping()) ?? {};
              this.markReachable(device);
              if (deviceTime) device.deviceTime = deviceTime;
            } catch (raw) {
              this.markUnreachable(device, asDeviceError(raw));
            }
          }),
        ),
    );
    try {
      await this.client.heartbeat({
        agentVersion: this.agentVersion,
        queueDepth: this.store.queueDepth(),
        devices: devices.map((device) => ({
          gateId: device.config.gateId,
          reachable: device.reachable,
          lastError: device.lastError,
          lastEventAt: device.lastEventAt,
          deviceTime: device.deviceTime,
        })),
      });
    } catch (err) {
      if (this.handleAuthError(err)) return;
      this.log.warn(`⚠️ Heartbeat gönderilemedi: ${err.message}`);
    }
  }

  markReachable(device) {
    device.reachable = true;
    device.lastError = null;
  }

  markUnreachable(device, err) {
    device.reachable = false;
    device.lastError = err.message.slice(0, 300);
  }

  handleAuthError(err) {
    if (!err?.isAuthError) return false;
    if (!this.revoked) {
      this.revoked = true;
      this.log.error(
        '⛔ MainApi bu agent kimliğini kabul etmiyor (iptal edilmiş olabilir). ' +
          'Admin panelinden yeni eşleştirme kodu alıp `npm run enroll -- KOD` ile yeniden eşleştirin.',
      );
    }
    return true;
  }

  stop() {
    this.stopped = true;
    for (const device of this.devices.values()) device.adapter.close();
  }
}

module.exports = { AgentRuntime };
