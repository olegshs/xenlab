import { ratioToCents } from './frequency';
import { noteLabel } from './noteNames';

export interface RatioApprox {
  p: number;
  q: number;
  cents: number;
  error: number;
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

function maxPrime(n: number): number {
  let m = 1;
  for (let p = 2; p * p <= n; p++) {
    while (n % p === 0) {
      m = Math.max(m, p);
      n /= p;
    }
  }
  return Math.max(m, n);
}

/** Simple ratios from 1/1 to 4/1, 13-limit, bounded complexity (p·q), simplest first. */
const RATIOS: RatioApprox[] = (() => {
  const out: RatioApprox[] = [];
  for (let q = 1; q <= 64; q++) {
    for (let p = q; p <= q * 4; p++) {
      if (gcd(p, q) !== 1) continue;
      if (p * q > 1200) continue;
      if (maxPrime(p) > 13 || maxPrime(q) > 13) continue;
      out.push({ p, q, cents: ratioToCents(p / q), error: 0 });
    }
  }
  return out.sort((a, b) => a.p * a.q - b.p * b.q);
})();

/**
 * Nearest "simple" ratio: among ratios within `tolerance` cents the simplest one wins;
 * if there are none, the closest one is returned.
 */
export function approximateRatio(cents: number, tolerance = 18): RatioApprox | null {
  if (cents < -0.5 || cents > 2400.5) return null;
  let closest: RatioApprox | null = null;
  for (const r of RATIOS) {
    const error = cents - r.cents;
    if (Math.abs(error) <= tolerance) return { ...r, error };
    if (!closest || Math.abs(error) < Math.abs(closest.error)) closest = { ...r, error };
  }
  return closest;
}

export interface Nearest12 {
  /** Pitch class 0..11, 0 = C. */
  pc: number;
  octave: number;
  /** Letter name, e.g. "C♯4". */
  name: string;
  /** Deviation from the 12-TET note in cents. */
  deviation: number;
}

/** Nearest 12-TET note (A4 = 440) and its deviation in cents. */
export function nearest12(freq: number): Nearest12 {
  const midi = 69 + 12 * Math.log2(freq / 440);
  const r = Math.round(midi);
  const pc = ((r % 12) + 12) % 12;
  const octave = Math.floor(r / 12) - 1;
  return { pc, octave, name: noteLabel(pc, octave, 'letters'), deviation: (midi - r) * 100 };
}
