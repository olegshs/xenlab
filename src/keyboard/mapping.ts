import { stepsForInterval } from '../tuning/frequency';
import type { Tuning } from '../tuning/types';
import { ALL_KEYS, type PhysKey } from './layouts';

export type LayoutMode = 'sequential' | 'isomorphic';
export type IsoPreset = 'wicki' | 'chromatic' | 'custom';

export interface LayoutSettings {
  mode: LayoutMode;
  /** Isomorphic: step (in degrees) for one key to the right. */
  stepRight: number;
  /** Isomorphic: step for one key up-right (Z → S). */
  stepUpRight: number;
  isoPreset: IsoPreset;
  /** Transpose of the whole layout, in degrees. */
  transpose: number;
}

/**
 * Degree of a key, ignoring transpose.
 * Sequential: Z row → A row → Q row → digits, consecutively.
 * Isomorphic: on QWERTY the key with the same index in the row above lies up-left,
 * so the up-left step = stepUpRight − stepRight.
 */
export function keyDegree(key: PhysKey, s: LayoutSettings): number {
  if (s.mode === 'sequential') {
    return SEQ_INDEX.get(key.code) ?? 0;
  }
  const upLeft = s.stepUpRight - s.stepRight;
  return key.col * s.stepRight + key.row * upLeft;
}

const SEQ_INDEX = (() => {
  const m = new Map<string, number>();
  const byRow = [...ALL_KEYS].sort((a, b) => a.row - b.row || a.col - b.col);
  byRow.forEach((k, i) => m.set(k.code, i));
  return m;
})();

export function buildKeyMap(s: LayoutSettings): Map<string, number> {
  const m = new Map<string, number>();
  for (const k of ALL_KEYS) m.set(k.code, keyDegree(k, s) + s.transpose);
  return m;
}

/** Isomorphic layout steps for a preset, fitted to the current tuning. */
export function isoPresetSteps(t: Tuning, preset: IsoPreset): { stepRight: number; stepUpRight: number } | null {
  const tone = stepsForInterval(t, 203.91); // 9/8
  const fifth = stepsForInterval(t, 701.955); // 3/2
  const third = stepsForInterval(t, 386.314); // 5/4
  switch (preset) {
    case 'wicki':
      return { stepRight: Math.max(1, tone), stepUpRight: Math.max(2, fifth) };
    case 'chromatic':
      return { stepRight: 1, stepUpRight: Math.max(2, third) };
    case 'custom':
      return null;
  }
}
