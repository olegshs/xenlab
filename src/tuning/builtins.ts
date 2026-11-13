import type { MessageKey } from '../i18n/locales/en';
import { C4, edo, edx, fromPitchList } from './generators';
import type { Tuning } from './types';

export interface BuiltinTuning {
  id: string;
  /** Language-neutral label (e.g. "31-EDO"); otherwise labelKey is translated. */
  label?: string;
  labelKey?: MessageKey;
  make: () => Tuning;
}

const EDOS = [5, 7, 12, 17, 19, 22, 24, 31, 41, 53, 72];

export const BUILTIN_TUNINGS: BuiltinTuning[] = [
  ...EDOS.map((n) => ({ id: `edo-${n}`, label: `${n}-EDO`, make: () => edo(n) })),
  {
    id: 'bp',
    label: 'Bohlen–Pierce (13-ED3)',
    make: () => edx(13, '3/1'),
  },
  {
    id: 'ji5',
    labelKey: 'builtin.ji5',
    make: () =>
      fromPitchList(
        'JI 5-limit',
        ['16/15', '9/8', '6/5', '5/4', '4/3', '45/32', '3/2', '8/5', '5/3', '9/5', '15/8', '2/1'],
        C4,
      ),
  },
  {
    id: 'pyth',
    labelKey: 'builtin.pyth',
    make: () =>
      fromPitchList(
        'Pythagorean',
        ['256/243', '9/8', '32/27', '81/64', '4/3', '729/512', '3/2', '128/81', '27/16', '16/9', '243/128', '2/1'],
        C4,
      ),
  },
  {
    id: 'harm',
    labelKey: 'builtin.harm',
    make: () =>
      fromPitchList('Harmonics 8–16', ['9/8', '10/8', '11/8', '12/8', '13/8', '14/8', '15/8', '2/1'], C4 / 2),
  },
];

const EPS = 1e-9;
const close = (a: number, b: number) => Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));

/** True when two tunings sound the same: same degrees, period, base frequency and no edits. Names are ignored. */
export function sameTuning(a: Tuning, b: Tuning): boolean {
  return (
    a.stepsCents.length === b.stepsCents.length &&
    a.stepsCents.every((c, i) => close(c, b.stepsCents[i])) &&
    close(a.periodCents, b.periodCents) &&
    close(a.baseFreq, b.baseFreq) &&
    Object.keys(a.offsets).length === 0 &&
    Object.keys(b.offsets).length === 0 &&
    Object.keys(a.absOverrides).length === 0 &&
    Object.keys(b.absOverrides).length === 0
  );
}

let made: { id: string; tuning: Tuning }[] | null = null;

/** Id of the built-in tuning that the given tuning still matches exactly, or null once anything was changed. */
export function matchBuiltin(t: Tuning): string | null {
  made ??= BUILTIN_TUNINGS.map((b) => ({ id: b.id, tuning: b.make() }));
  return made.find((m) => sameTuning(t, m.tuning))?.id ?? null;
}
