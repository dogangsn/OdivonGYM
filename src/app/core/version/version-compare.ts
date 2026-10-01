/** Compares the x.y.z part of two versions; anything after `+` or `-` is ignored. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.split(/[+-]/)[0].split('.').map((n) => Number.parseInt(n, 10) || 0);
  const [left, right] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

/** Storage keys that survive an update: the user's own display preferences. */
export const PRESERVED_STORAGE_KEYS = ['odivongym-theme', 'odivongym-language'];
