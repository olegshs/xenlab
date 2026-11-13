import { AppError } from '../errors';
import { parsePitch, type ScalaScale } from './scala';
import type { Tuning } from './types';

/** C4 at A4 = 440 Hz. */
export const C4 = 440 * Math.pow(2, -9 / 12);

function make(
  name: string,
  stepsCents: number[],
  periodCents: number,
  source: Tuning['source'],
  baseFreq = C4,
  description?: string,
): Tuning {
  return { name, description, stepsCents, periodCents, baseFreq, offsets: {}, absOverrides: {}, source };
}

function checkN(n: number) {
  if (!Number.isInteger(n) || n < 1 || n > 1000) throw new AppError('err.nRange');
}

export function edo(n: number, baseFreq = C4): Tuning {
  checkN(n);
  const steps = Array.from({ length: n }, (_, i) => (i * 1200) / n);
  return make(`${n}-EDO`, steps, 1200, { kind: 'edo', n }, baseFreq);
}

/** Equal division of any interval: interval is "3/1", "3", "1901.955", etc. */
export function edx(n: number, interval: string, baseFreq = C4): Tuning {
  checkN(n);
  const period = parsePitch(interval);
  if (period <= 0) throw new AppError('err.intervalTooSmall');
  const steps = Array.from({ length: n }, (_, i) => (i * period) / n);
  return make(`${n}-ED${interval}`, steps, period, { kind: 'edx', n, interval }, baseFreq);
}

/** Tuning from a list of pitches in cents (without 1/1; the last value is the period). */
export function fromPitches(
  name: string,
  pitchesCents: number[],
  baseFreq = C4,
  kind: 'scala' | 'custom' = 'custom',
): Tuning {
  if (pitchesCents.length === 0) throw new AppError('err.noDegrees');
  const period = pitchesCents[pitchesCents.length - 1];
  if (period <= 0) throw new AppError('err.periodPositive');
  return make(name, [0, ...pitchesCents.slice(0, -1)], period, { kind }, baseFreq);
}

export function fromScala(scale: ScalaScale, name: string, baseFreq = C4): Tuning {
  const t = fromPitches(name, scale.pitches, baseFreq, 'scala');
  t.description = scale.description;
  return t;
}

/** Lines in Scala syntax ("3/2", "701.955", "2"), one degree per line; the last one is the period. */
export function fromPitchList(name: string, lines: string[], baseFreq = C4): Tuning {
  const values = lines.map((l) => l.trim()).filter((l) => l && !l.startsWith('!'));
  return fromPitches(name, values.map(parsePitch), baseFreq, 'custom');
}
