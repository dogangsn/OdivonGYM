'use strict';

/**
 * Cihaz saatleri Türkiye yerel saatidir (Europe/Istanbul, 2016'dan beri sabit UTC+03:00).
 * "YYYY-MM-DD HH:mm:ss", "YYYY/MM/DD HH:mm:ss" veya "YYYYMMDDHHmmss" → ISO 8601 (+03:00).
 * Zaten saat dilimi taşıyan değerler olduğu gibi normalleştirilir.
 */
function toIstanbulIso(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return new Date(value < 1e12 ? value * 1000 : value).toISOString();
  const text = String(value).trim();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text)) {
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const m =
    /^(\d{4})[-/]?(\d{2})[-/]?(\d{2})[ T]?(\d{2}):?(\d{2}):?(\d{2})?$/.exec(text);
  if (!m) return null;
  const [, y, mo, d, h, mi, s = '00'] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}+03:00`;
}

/** Türkiye saatine göre gün, YYYYMMDD. `offsetDays` ile önceki/sonraki gün. */
function istanbulDay(now = new Date(), offsetDays = 0) {
  const shifted = new Date(now.getTime() + 3 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10).replace(/-/g, '');
}

module.exports = { toIstanbulIso, istanbulDay };
