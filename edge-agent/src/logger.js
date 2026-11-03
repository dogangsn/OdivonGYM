'use strict';

/**
 * Agent günlüğü: konsola, dönen dosyaya (data/logs/agent.log) ve arayüz için bellekteki
 * son kayıtlara yazar. Arka planda (SYSTEM görevi) çalışırken konsol görünmediği için
 * sorunlar yalnızca buradan izlenebilir.
 */

const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');

const LEVELS = ['debug', 'info', 'warn', 'error'];

class Logger {
  constructor({ dir = null, maxBytes = 5 * 1024 * 1024, keepFiles = 5, ringSize = 2000, console: out = console, now = () => new Date() } = {}) {
    this.dir = dir;
    this.file = dir ? path.join(dir, 'agent.log') : null;
    this.maxBytes = maxBytes;
    this.keepFiles = keepFiles;
    this.ringSize = ringSize;
    this.out = out;
    this.now = now;
    this.entries = [];
    this.seq = 0;
    this.listeners = new Set();
    this.bytes = 0;
    if (this.file) {
      fs.mkdirSync(dir, { recursive: true });
      try {
        this.bytes = fs.statSync(this.file).size;
      } catch {
        this.bytes = 0;
      }
    }
  }

  debug(...args) {
    this.write('debug', args);
  }

  info(...args) {
    this.write('info', args);
  }

  warn(...args) {
    this.write('warn', args);
  }

  error(...args) {
    this.write('error', args);
  }

  /** Geçiş kaydı gibi yapılandırılmış satırlar için `kind` ve ek alanlar. */
  event(kind, message, fields = {}) {
    this.write('info', [message], { kind, ...fields });
  }

  write(level, args, fields = {}) {
    const message = args
      .map((arg) => (typeof arg === 'string' ? arg : arg instanceof Error ? arg.stack || arg.message : util.inspect(arg, { depth: 4 })))
      .join(' ');
    const entry = { seq: ++this.seq, time: this.now().toISOString(), level, message, ...fields };
    this.entries.push(entry);
    if (this.entries.length > this.ringSize) this.entries.splice(0, this.entries.length - this.ringSize);

    const sink = level === 'error' ? this.out.error : level === 'warn' ? this.out.warn : this.out.log;
    sink?.call(this.out, message);
    this.appendToFile(entry);
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch {
        /* arayüz bağlantısı kopmuş olabilir */
      }
    }
  }

  appendToFile(entry) {
    if (!this.file) return;
    const line = `${localStamp(new Date(entry.time))} ${entry.level.toUpperCase().padEnd(5)} ${entry.message}\n`;
    try {
      if (this.bytes + Buffer.byteLength(line) > this.maxBytes) this.rotate();
      fs.appendFileSync(this.file, line, 'utf8');
      this.bytes += Buffer.byteLength(line);
    } catch {
      /* disk dolu / izin yok: agent çalışmaya devam etmeli */
    }
  }

  rotate() {
    for (let i = this.keepFiles - 1; i >= 1; i--) {
      const from = `${this.file}.${i}`;
      if (fs.existsSync(from)) fs.renameSync(from, `${this.file}.${i + 1}`);
    }
    fs.rmSync(`${this.file}.${this.keepFiles}`, { force: true });
    if (fs.existsSync(this.file)) fs.renameSync(this.file, `${this.file}.1`);
    this.bytes = 0;
  }

  /** Arayüz için filtreli son kayıtlar (yeniden eskiye değil, eskiden yeniye). */
  recent({ level = 'debug', q = '', kind = null, afterSeq = 0, limit = 500 } = {}) {
    const min = Math.max(0, LEVELS.indexOf(level));
    const needle = String(q || '').toLocaleLowerCase('tr');
    const out = this.entries.filter(
      (entry) =>
        entry.seq > afterSeq &&
        LEVELS.indexOf(entry.level) >= min &&
        (!kind || entry.kind === kind) &&
        (!needle || entry.message.toLocaleLowerCase('tr').includes(needle)),
    );
    return out.slice(-limit);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/** Türkiye saatiyle "2026-11-03 18:12:01". */
function localStamp(date) {
  const shifted = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return shifted.toISOString().replace('T', ' ').slice(0, 19);
}

module.exports = { Logger, LEVELS, localStamp };
