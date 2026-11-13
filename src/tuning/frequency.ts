import type { Tuning } from './types';

export const ratioToCents = (r: number) => 1200 * Math.log2(r);
export const centsToRatio = (c: number) => Math.pow(2, c / 1200);

export const stepCount = (t: Tuning) => t.stepsCents.length;

/** Degree class 0..N-1 of an absolute degree (negative degrees included). */
export function degreeClass(n: number, degree: number): number {
  return ((degree % n) + n) % n;
}

/** Period (octave) index of an absolute degree. */
export function periodIndex(n: number, degree: number): number {
  return Math.floor(degree / n);
}

/** Cents of degree class i including the manual adjustment (within one period). */
export function classCents(t: Tuning, i: number): number {
  return t.stepsCents[i] + (t.offsets[i] ?? 0);
}

/** Cents of an absolute degree relative to baseFreq (ignoring absOverrides). */
export function centsOf(t: Tuning, degree: number): number {
  const n = stepCount(t);
  return periodIndex(n, degree) * t.periodCents + classCents(t, degreeClass(n, degree));
}

export function freqOf(t: Tuning, degree: number): number {
  const o = t.absOverrides[degree];
  if (o !== undefined && o > 0) return o;
  return t.baseFreq * centsToRatio(centsOf(t, degree));
}

/** Number of tuning steps that best approximates the given interval (in cents). */
export function stepsForInterval(t: Tuning, cents: number): number {
  const n = stepCount(t);
  let best = 1;
  let bestErr = Infinity;
  for (let k = 1; k <= n * 3; k++) {
    const err = Math.abs(centsOf(t, k) - cents);
    if (err < bestErr) {
      bestErr = err;
      best = k;
    }
  }
  return best;
}
