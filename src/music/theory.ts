import type { MessageKey } from '../i18n/locales/en';
import { degreeClass, freqOf, ratioToCents, stepCount } from '../tuning/frequency';
import { approximateRatio } from '../tuning/ratios';
import type { Tuning } from '../tuning/types';

/** Deterministic PRNG (mulberry32): the same seed always gives the same sequence in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Absolute pitch of a degree in cents above 1 Hz (includes per-note overrides). */
export const pitchCents = (t: Tuning, degree: number) => ratioToCents(freqOf(t, degree));

/** Interval between two degrees in cents. */
export const intervalCents = (t: Tuning, from: number, to: number) => pitchCents(t, to) - pitchCents(t, from);

export interface Approx {
  steps: number;
  /** Actual size in cents. */
  cents: number;
  /** Actual minus target, in cents. */
  error: number;
}

/** The number of steps above `root` that best approximates `targetCents`. Works for unequal tunings too. */
export function bestSteps(t: Tuning, root: number, targetCents: number): Approx {
  const n = stepCount(t);
  const base = pitchCents(t, root);
  let best: Approx = { steps: 1, cents: NaN, error: Infinity };
  for (let s = 1; s <= n * 3; s++) {
    const cents = pitchCents(t, root + s) - base;
    const error = cents - targetCents;
    if (Math.abs(error) < Math.abs(best.error)) best = { steps: s, cents, error };
    if (cents > targetCents + 1200) break;
  }
  return best;
}

export const approx = (t: Tuning, ratio: number, root = 0) => bestSteps(t, root, ratioToCents(ratio));

// ---------------------------------------------------------------------------
// Chords

/** Largest interval error (cents) for a chord to count as playable; 12-EDO minor third is off by 15.6. */
export const CHORD_TOLERANCE = 18;

export interface ChordType {
  id: string;
  key: MessageKey;
  /** Ratio notation such as "4:5:6". */
  label: string;
  /** Ratios of the upper tones to the root, ascending. */
  ratios: number[];
}

/** From the most common to the most exotic; the order is also the display order. */
export const CHORD_TYPES: ChordType[] = [
  { id: 'major', key: 'chord.major', label: '4:5:6', ratios: [5 / 4, 3 / 2] },
  { id: 'minor', key: 'chord.minor', label: '10:12:15', ratios: [6 / 5, 3 / 2] },
  { id: 'harm7', key: 'chord.harm7', label: '4:5:6:7', ratios: [5 / 4, 3 / 2, 7 / 4] },
  { id: 'subminor', key: 'chord.subminor', label: '6:7:9', ratios: [7 / 6, 3 / 2] },
  { id: 'supermajor', key: 'chord.supermajor', label: '14:18:21', ratios: [9 / 7, 3 / 2] },
  { id: 'neutral', key: 'chord.neutral', label: '18:22:27', ratios: [11 / 9, 3 / 2] },
  { id: 'sus4', key: 'chord.sus4', label: '6:8:9', ratios: [4 / 3, 3 / 2] },
  { id: 'quartal', key: 'chord.quartal', label: '9:12:16', ratios: [4 / 3, 16 / 9] },
  { id: 'bp', key: 'chord.bp', label: '3:5:7', ratios: [5 / 3, 7 / 3] },
];

export const chordType = (id: string) => CHORD_TYPES.find((c) => c.id === id)!;

export interface ChordFit {
  type: ChordType;
  root: number;
  /** Steps of the upper tones above the root, strictly ascending. */
  steps: number[];
  errors: number[];
  /** Largest absolute error, in cents. */
  maxError: number;
  /** True when no chord fitted the tolerance and this is the best of the rest. */
  approximate?: boolean;
}

/** Best realisation of a chord type on `root`, or null when tones would coincide. */
export function fitChord(t: Tuning, root: number, type: ChordType): ChordFit | null {
  const approxes = type.ratios.map((r) => approx(t, r, root));
  const steps = approxes.map((a) => a.steps);
  for (let i = 0; i < steps.length; i++) if (steps[i] <= (i === 0 ? 0 : steps[i - 1])) return null;
  const errors = approxes.map((a) => a.error);
  return { type, root, steps, errors, maxError: Math.max(...errors.map(Math.abs)) };
}

export const chordDegrees = (f: ChordFit) => [f.root, ...f.steps.map((s) => f.root + s)];

/**
 * Chords that the tuning plays well on `root`: every interval within `maxError` cents.
 * Identical step patterns are listed once (the simpler chord wins).
 * When nothing fits, the three closest chords are returned and marked approximate.
 */
export function availableChords(t: Tuning, root = 0, maxError = CHORD_TOLERANCE): ChordFit[] {
  const fits = CHORD_TYPES.map((c) => fitChord(t, root, c)).filter((f): f is ChordFit => f !== null);
  const seen = new Set<string>();
  const good: ChordFit[] = [];
  for (const f of fits) {
    const key = f.steps.join(',');
    if (f.maxError <= maxError && !seen.has(key)) {
      seen.add(key);
      good.push(f);
    }
  }
  if (good.length > 0) return good;
  return fits
    .sort((a, b) => a.maxError - b.maxError)
    .filter((f) => {
      const key = f.steps.join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .map((f) => ({ ...f, approximate: true }));
}

// ---------------------------------------------------------------------------
// Scales and harmony helpers

/** True when the period is (close to) an octave. */
export const isOctaveBased = (t: Tuning) => Math.abs(t.periodCents - 1200) < 30;

/**
 * A 7-note "diatonic" scale (degree classes) generated by a chain of the tuning's best fifth,
 * like F–C–G–D–A–E–B. Small tunings use all degrees; non-octave tunings use all degrees
 * up to 13, otherwise 9 evenly spaced ones.
 */
export function buildScale(t: Tuning): number[] {
  const n = stepCount(t);
  const all = Array.from({ length: n }, (_, i) => i);
  if (n <= 7) return all;
  if (!isOctaveBased(t)) {
    return n <= 13 ? all : evenly(n, 9);
  }
  const g = approx(t, 3 / 2).steps;
  const chain = new Set<number>();
  for (let k = -1; k <= 5; k++) chain.add(degreeClass(n, k * g));
  if (chain.size === 7) return [...chain].sort((a, b) => a - b);
  return n <= 12 ? all : evenly(n, 7);
}

function evenly(n: number, count: number): number[] {
  return [...new Set(Array.from({ length: count }, (_, i) => Math.round((i * n) / count)))];
}

/**
 * How well two roots relate: a consonant root movement (fifth, fourth, thirds…) weighs more.
 * Based on the simplest ratio within 15 cents of the interval reduced into one period.
 */
export function movementWeight(t: Tuning, from: number, to: number): number {
  if (from === to) return 0;
  let c = intervalCents(t, from, to) % t.periodCents;
  if (c < 0) c += t.periodCents;
  const r = approximateRatio(c, 15);
  if (!r || Math.abs(r.error) > 15 || r.p * r.q === 1) return 0.4;
  return 6 / Math.log2(r.p * r.q);
}

/**
 * Comma pump I–vi–ii–V–I built from pure intervals: vi a minor third below, then three fourths up.
 * Returns how many degrees the tonic moves per cycle (0 means the tuning tempers out 81/80),
 * or null when the tuning has no usable octave, fourth or minor third.
 */
export function pumpDrift(t: Tuning): number | null {
  if (!isOctaveBased(t)) return null;
  const fourth = approx(t, 4 / 3);
  const minorThird = approx(t, 6 / 5);
  if (Math.abs(fourth.error) > 30 || Math.abs(minorThird.error) > 30) return null;
  return 3 * fourth.steps - minorThird.steps - stepCount(t);
}

/** The syntonic comma 81/80 in cents: how far the tonic falls per pump cycle in just intonation. */
export const SYNTONIC_COMMA = ratioToCents(81 / 80);
