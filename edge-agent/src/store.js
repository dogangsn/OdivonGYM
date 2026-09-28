'use strict';

/**
 * Kalıcı yerel durum (Node yerleşik SQLite, yerel derleme gerekmez).
 *
 * - events:  MainApi'ye henüz gönderilmemiş geçiş olayları. İnternet yoksa
 *            burada bekler; gönderim onaylanınca silinir.
 * - seen:    cihazdan daha önce okunmuş olay kimlikleri (tekrar kuyruğa
 *            almamak için). 45 günden eskiler budanır.
 * - cursors: cihaz başına log okuma imleci.
 */

const { DatabaseSync } = require('node:sqlite');

const DEVICES_KEY = '__devices__';
const SEEN_RETENTION_MS = 45 * 24 * 60 * 60 * 1000;

class Store {
  constructor(file) {
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gate_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE (gate_id, event_id)
      );
      CREATE TABLE IF NOT EXISTS seen (
        gate_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        seen_at INTEGER NOT NULL,
        PRIMARY KEY (gate_id, event_id)
      );
      CREATE TABLE IF NOT EXISTS cursors (
        gate_id TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    this.stmts = {
      seen: this.db.prepare('INSERT OR IGNORE INTO seen (gate_id, event_id, seen_at) VALUES (?, ?, ?)'),
      insertEvent: this.db.prepare(
        'INSERT OR IGNORE INTO events (gate_id, event_id, payload, created_at) VALUES (?, ?, ?, ?)',
      ),
      peek: this.db.prepare('SELECT id, payload FROM events ORDER BY id LIMIT ?'),
      depth: this.db.prepare('SELECT COUNT(*) AS n FROM events'),
      getCursor: this.db.prepare('SELECT value FROM cursors WHERE gate_id = ?'),
      setCursor: this.db.prepare(
        'INSERT INTO cursors (gate_id, value) VALUES (?, ?) ON CONFLICT(gate_id) DO UPDATE SET value = excluded.value',
      ),
      prune: this.db.prepare('DELETE FROM seen WHERE seen_at < ?'),
    };
  }

  /** Olayları ve imleci tek transaction'da yazar. Yeni kuyruğa alınan olay sayısını döner. */
  enqueueEvents(gateId, events, cursor) {
    const now = Date.now();
    let added = 0;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const event of events) {
        const fresh = this.stmts.seen.run(gateId, event.eventId, now).changes > 0;
        if (!fresh) continue;
        this.stmts.insertEvent.run(gateId, event.eventId, JSON.stringify({ ...event, gateId }), now);
        added += 1;
      }
      if (cursor !== undefined) this.stmts.setCursor.run(gateId, JSON.stringify(cursor));
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    return added;
  }

  peekEvents(limit) {
    return this.stmts.peek.all(limit).map((row) => ({ rowId: row.id, event: JSON.parse(row.payload) }));
  }

  deleteEvents(rowIds) {
    if (rowIds.length === 0) return;
    const placeholders = rowIds.map(() => '?').join(',');
    this.db.prepare(`DELETE FROM events WHERE id IN (${placeholders})`).run(...rowIds);
  }

  queueDepth() {
    return Number(this.stmts.depth.get().n);
  }

  getCursor(gateId) {
    const row = this.stmts.getCursor.get(gateId);
    return row ? JSON.parse(row.value) : null;
  }

  setCursor(gateId, value) {
    this.stmts.setCursor.run(gateId, JSON.stringify(value));
  }

  /** Son bilinen cihaz listesi: MainApi'ye ulaşılamasa da olay okumaya devam etmek için. */
  saveDevices(devices) {
    this.setCursor(DEVICES_KEY, devices);
  }

  loadDevices() {
    return this.getCursor(DEVICES_KEY) ?? [];
  }

  prune(now = Date.now()) {
    this.stmts.prune.run(now - SEEN_RETENTION_MS);
  }

  close() {
    this.db.close();
  }
}

module.exports = { Store };
