import type { MessageKey } from '../i18n/locales/en';
import { degreeClass, stepCount } from '../tuning/frequency';
import type { Tuning } from '../tuning/types';
import {
  approx,
  availableChords,
  buildScale,
  chordDegrees,
  chordType,
  fitChord,
  intervalCents,
  isOctaveBased,
  movementWeight,
  pumpDrift,
  rng,
  type ChordFit,
} from './theory';

export type Part = 'melody' | 'chord' | 'bass';

export interface ScoreNote {
  degree: number;
  /** Start and duration in beats. */
  start: number;
  dur: number;
  part: Part;
  /** Relative loudness, 0..1. */
  gain: number;
}

export interface SectionLabel {
  key: MessageKey;
  params?: Record<string, string | number>;
  /** Params that are themselves translation keys (e.g. a chord name). */
  keyParams?: Record<string, MessageKey>;
}

export interface Section {
  start: number;
  label: SectionLabel;
}

export interface Score {
  notes: ScoreNote[];
  sections: Section[];
  /** Total length in beats. */
  length: number;
}

export type Texture = 'chorale' | 'arpeggio';

export interface PieceOptions {
  seed: number;
  bars: number;
  texture: Texture;
}

const GAIN = { melody: 1, chord: 0.5, bass: 0.7 } as const;

/** "+1.9" / "−3.4" with a real minus sign. */
export const signed = (c: number, digits = 1) => `${c >= 0 ? '+' : '−'}${Math.abs(c).toFixed(digits)}`;

class ScoreBuilder {
  notes: ScoreNote[] = [];
  sections: Section[] = [];
  time = 0;

  note(degree: number, start: number, dur: number, part: Part, gain: number = GAIN[part]) {
    this.notes.push({ degree, start, dur, part, gain });
  }
  section(label: SectionLabel, start = this.time) {
    this.sections.push({ start, label });
  }
  build(): Score {
    const end = this.notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0);
    this.notes.sort((a, b) => a.start - b.start);
    return { notes: this.notes, sections: this.sections, length: Math.max(this.time, end) };
  }
}

/** Signed largest error of a chord. */
const chordError = (f: ChordFit) => f.errors.reduce((m, e) => (Math.abs(e) > Math.abs(m) ? e : m), 0);

function pick<T>(items: T[], weights: number[], random: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return items[Math.floor(random() * items.length)];
  let x = random() * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ---------------------------------------------------------------------------
// Voicing

const BASS_RANGE: [number, number] = [-1500, -150];
const UPPER_RANGE: [number, number] = [-150, 1750];
const ARP_RANGE: [number, number] = [-150, 1250];
const MELODY_RANGE: [number, number] = [1100, 2500];

/** Degrees of the given class whose pitch (cents above degree 0) lies in [lo, hi]. */
function inRange(t: Tuning, cls: number, [lo, hi]: [number, number]): number[] {
  const n = stepCount(t);
  const out: number[] = [];
  for (let k = -4; k <= 4; k++) {
    const d = cls + k * n;
    const c = intervalCents(t, 0, d);
    if (c >= lo && c <= hi) out.push(d);
  }
  return out;
}

/** The bass note for a chord root: in the bass range, as close as possible to the previous bass. */
function bassNote(t: Tuning, root: number, prev: number | null): number {
  const n = stepCount(t);
  const options = inRange(t, degreeClass(n, root), BASS_RANGE);
  if (options.length === 0) return root - n;
  const target = prev === null ? -700 : intervalCents(t, 0, prev);
  return options.reduce((best, d) =>
    Math.abs(intervalCents(t, 0, d) - target) < Math.abs(intervalCents(t, 0, best) - target) ? d : best,
  );
}

/**
 * Places each chord tone (by degree class) in `range` so that the voices move as little as possible
 * from the previous chord. Small brute force: at most a few octave choices per tone.
 */
function voiceChord(t: Tuning, tones: number[], prev: number[] | null, range: [number, number]): number[] {
  const n = stepCount(t);
  const classes = [...new Set(tones.map((d) => degreeClass(n, d)))];
  const candidates = classes.map((c) => inRange(t, c, range));
  if (candidates.some((c) => c.length === 0)) return tones.slice().sort((a, b) => a - b);
  const cents = (d: number) => intervalCents(t, 0, d);
  const prevCents = prev?.map(cents).sort((a, b) => a - b) ?? null;

  let best: number[] = [];
  let bestCost = Infinity;
  const combo: number[] = [];
  const walk = (i: number) => {
    if (i === candidates.length) {
      const sorted = combo.map(cents).sort((a, b) => a - b);
      const spread = sorted[sorted.length - 1] - sorted[0];
      if (spread > 1900) return;
      let cost = spread * 0.15;
      if (prevCents) {
        for (const c of sorted) cost += Math.min(...prevCents.map((p) => Math.abs(p - c)));
        for (const p of prevCents) cost += Math.min(...sorted.map((c) => Math.abs(p - c))) * 0.5;
      } else {
        cost += Math.abs(sorted[0] - 0) * 0.3;
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = combo.slice();
      }
      return;
    }
    for (const d of candidates[i]) {
      combo.push(d);
      walk(i + 1);
      combo.pop();
    }
  };
  walk(0);
  return (best.length ? best : tones).slice().sort((a, b) => cents(a) - cents(b));
}

// ---------------------------------------------------------------------------
// Demo of a tuning

interface NamedInterval {
  ratio: number;
  label: string;
  key: MessageKey;
}

const OCTAVE_INTERVALS: NamedInterval[] = [
  { ratio: 3 / 2, label: '3/2', key: 'interval.fifth' },
  { ratio: 5 / 4, label: '5/4', key: 'interval.majorThird' },
  { ratio: 6 / 5, label: '6/5', key: 'interval.minorThird' },
  { ratio: 7 / 4, label: '7/4', key: 'interval.harmonicSeventh' },
  { ratio: 7 / 6, label: '7/6', key: 'interval.septimalMinorThird' },
  { ratio: 11 / 8, label: '11/8', key: 'interval.undecimalFourth' },
];

const NON_OCTAVE_INTERVALS: NamedInterval[] = [
  { ratio: 9 / 7, label: '9/7', key: 'interval.septimalMajorThird' },
  { ratio: 7 / 5, label: '7/5', key: 'interval.septimalTritone' },
  { ratio: 5 / 3, label: '5/3', key: 'interval.majorSixth' },
  { ratio: 7 / 3, label: '7/3', key: 'interval.septimalTenth' },
  { ratio: 3, label: '3/1', key: 'interval.tritave' },
];

/** Scale run, characteristic intervals (melodic, then harmonic) and every chord the tuning plays well. */
export function demoScore(t: Tuning): Score {
  const b = new ScoreBuilder();
  const n = stepCount(t);

  // 1. All degrees up and down over a quiet reference drone.
  b.section({ key: 'gen.secScale', params: { n } });
  const dur = n > 24 ? 0.25 : 0.5;
  const run = [...Array.from({ length: n + 1 }, (_, i) => i), ...Array.from({ length: n }, (_, i) => n - 1 - i)];
  run.forEach((d, i) => b.note(d, b.time + i * dur, dur * 0.95, 'melody', 0.8));
  b.note(-n, b.time, run.length * dur, 'bass', 0.35);
  b.time += run.length * dur + 1;

  // 2. Characteristic intervals.
  for (const iv of isOctaveBased(t) ? OCTAVE_INTERVALS : NON_OCTAVE_INTERVALS) {
    const a = approx(t, iv.ratio);
    if (Math.abs(a.error) > 60) continue;
    b.section({
      key: 'gen.secInterval',
      params: { ratio: iv.label, steps: a.steps, err: signed(a.error) },
      keyParams: { name: iv.key },
    });
    b.note(0, b.time, 0.95, 'melody');
    b.note(a.steps, b.time + 1, 0.95, 'melody');
    b.note(0, b.time + 2, 2, 'chord', 0.7);
    b.note(a.steps, b.time + 2, 2, 'chord', 0.7);
    b.time += 5;
  }

  // 3. Chords: arpeggiated, then held over the root in the bass.
  for (const fit of availableChords(t, 0)) {
    b.section({
      key: fit.approximate ? 'gen.secChordApprox' : 'gen.secChord',
      params: { ratio: fit.type.label, err: signed(chordError(fit)) },
      keyParams: { name: fit.type.key },
    });
    const tones = chordDegrees(fit);
    tones.forEach((d, i) => b.note(d, b.time + i * 0.5, 0.48, 'melody', 0.8));
    const start = b.time + tones.length * 0.5;
    tones.forEach((d) => b.note(d, start, 3, 'chord', 0.6));
    b.note(fit.root - n, start, 3, 'bass');
    b.time = start + 3.5;
  }
  return b.build();
}

// ---------------------------------------------------------------------------
// Generated pieces

interface Option {
  fit: ChordFit;
  weight: number;
  colour: boolean;
}

/** Chords on `root`, weighted: common triads inside the scale first, "colour" chords of the tuning less often. */
function chordOptions(t: Tuning, root: number, scaleSet: Set<number>): Option[] {
  const n = stepCount(t);
  return availableChords(t, root).map((fit) => {
    const outside = chordDegrees(fit).filter((d) => !scaleSet.has(degreeClass(n, d))).length;
    const common = ['major', 'minor', 'bp'].includes(fit.type.id);
    return { fit, weight: (common ? 3 : 1) * Math.pow(0.15, outside), colour: outside > 0 || !common };
  });
}

function chooseOption(options: Option[], random: () => number): ChordFit {
  const colour = options.filter((o) => o.colour);
  if (colour.length && random() < 0.25) return pick(colour, colour.map(() => 1), random).fit;
  return pick(options, options.map((o) => o.weight), random).fit;
}

/** The tonic chord: major (or the BP triad) when available, otherwise the best the tuning has. */
function tonicChord(t: Tuning, root: number): ChordFit {
  const options = availableChords(t, root);
  return options.find((o) => o.type.id === 'major') ?? options.find((o) => o.type.id === 'bp') ?? options[0];
}

/** A chord progression over the generated scale, then rendered as a chorale or as arpeggios with a melody. */
export function pieceScore(t: Tuning, { seed, bars, texture }: PieceOptions): Score {
  const random = rng(seed);
  const n = stepCount(t);
  const scale = buildScale(t);
  const scaleSet = new Set(scale);
  const options = new Map(scale.map((r) => [r, chordOptions(t, r, scaleSet)]));
  const roots = scale.filter((r) => options.get(r)!.length > 0);

  // Dominant: the scale root a fifth above the tonic, or the best-related root.
  const fifth = degreeClass(n, approx(t, 3 / 2).steps);
  const dominant = isOctaveBased(t) && options.get(fifth)?.length
    ? fifth
    : roots.reduce((a, r) => (movementWeight(t, 0, r) > movementWeight(t, 0, a) ? r : a), roots[0]);

  const progression: ChordFit[] = [];
  let prevRoot = 0;
  for (let bar = 0; bar < bars; bar++) {
    let fit: ChordFit;
    if (bar === 0 || bar === bars - 1) {
      fit = tonicChord(t, 0);
    } else if (bar === bars - 2 && dominant !== 0) {
      const opts = availableChords(t, dominant);
      const harm7 = opts.find((o) => o.type.id === 'harm7');
      fit = harm7 && random() < 0.6 ? harm7 : (opts.find((o) => o.type.id === 'major') ?? opts[0]);
    } else {
      const candidates = roots.filter((r) => r !== prevRoot);
      const root = candidates.length
        ? pick(candidates, candidates.map((r) => movementWeight(t, prevRoot, r)), random)
        : prevRoot;
      fit = chooseOption(options.get(root)!, random);
    }
    progression.push(fit);
    prevRoot = degreeClass(n, fit.root);
  }

  const b = new ScoreBuilder();
  const melodyPool = melodyDegrees(t, scaleSet);
  let prevUpper: number[] | null = null;
  let prevBass: number | null = null;
  let prevMelody = melodyPool[Math.floor(melodyPool.length / 2)] ?? n;

  progression.forEach((fit, bar) => {
    const start = bar * 4;
    const last = bar === progression.length - 1;
    b.section(
      {
        key: 'gen.secPieceChord',
        params: { bar: bar + 1, ratio: fit.type.label, err: signed(chordError(fit)) },
        keyParams: { name: fit.type.key },
      },
      start,
    );
    const tones = chordDegrees(fit);
    const bass = bassNote(t, fit.root, prevBass);
    b.note(bass, start, 3.95, 'bass');
    prevBass = bass;

    if (texture === 'chorale') {
      const upper = voiceChord(t, tones, prevUpper, UPPER_RANGE);
      const top = upper[upper.length - 1];
      upper.slice(0, -1).forEach((d) => b.note(d, start, 3.95, 'chord'));
      const next = progression[bar + 1];
      if (last || !next) {
        b.note(top, start, 3.95, 'melody');
      } else {
        // Soprano: chord tone for two beats, then a passing or neighbour tone towards the next chord.
        b.note(top, start, 1.95, 'melody');
        const nextTop = voiceChord(t, chordDegrees(next), upper, UPPER_RANGE).at(-1)!;
        b.note(passingTone(t, top, nextTop, scaleSet, random), start + 2, 1.95, 'melody');
      }
      prevUpper = upper;
    } else {
      const arp = voiceChord(t, tones, prevUpper, ARP_RANGE);
      const pattern = [...arp, ...arp.slice(1, -1).reverse()];
      for (let i = 0; i < 8; i++) b.note(pattern[i % pattern.length], start + i * 0.5, 0.48, 'chord', 0.42);
      prevUpper = arp;
      prevMelody = melodyBar(t, b, start, tones, prevMelody, melodyPool, last, random);
    }
  });
  b.time = progression.length * 4;
  return b.build();
}

function melodyDegrees(t: Tuning, scaleSet: Set<number>): number[] {
  const n = stepCount(t);
  const out: number[] = [];
  for (let d = -n; d <= 4 * n; d++) {
    const c = intervalCents(t, 0, d);
    if (c >= MELODY_RANGE[0] && c <= MELODY_RANGE[1] && scaleSet.has(degreeClass(n, d))) out.push(d);
  }
  return out;
}

/** A scale note strictly between two pitches if there is one, otherwise a neighbour of the first. */
function passingTone(t: Tuning, from: number, to: number, scaleSet: Set<number>, random: () => number): number {
  const n = stepCount(t);
  const [lo, hi] = from < to ? [from, to] : [to, from];
  const between: number[] = [];
  for (let d = lo + 1; d < hi; d++) if (scaleSet.has(degreeClass(n, d))) between.push(d);
  if (between.length) return between[Math.floor(between.length / 2)];
  const dir = random() < 0.5 ? 1 : -1;
  for (let d = from + dir; Math.abs(d - from) <= n; d += dir) if (scaleSet.has(degreeClass(n, d))) return d;
  return from;
}

/** One bar of melody: a chord tone on beats 1 and 3, mostly stepwise motion in between. Returns the last note. */
function melodyBar(
  t: Tuning,
  b: ScoreBuilder,
  start: number,
  chordTones: number[],
  prev: number,
  pool: number[],
  last: boolean,
  random: () => number,
): number {
  const n = stepCount(t);
  const classes = new Set(chordTones.map((d) => degreeClass(n, d)));
  const nearestChordTone = (to: number) => {
    let best = to;
    let bestDist = Infinity;
    for (let d = to - n; d <= to + n; d++) {
      const c = intervalCents(t, 0, d);
      if (!classes.has(degreeClass(n, d)) || c < MELODY_RANGE[0] || c > MELODY_RANGE[1]) continue;
      const dist = Math.abs(intervalCents(t, to, d));
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    return best;
  };

  if (last) {
    const tonic = nearestChordTone(prev);
    b.note(tonic, start, 3.95, 'melody');
    return tonic;
  }
  let note = nearestChordTone(prev);
  b.note(note, start, 0.95, 'melody');
  const rhythm = random() < 0.3 ? [1, 2] : [1, 1, 1];
  let beat = 1;
  for (const len of rhythm) {
    if (beat === 2) {
      note = nearestChordTone(note);
    } else {
      const i = Math.max(0, pool.indexOf(note) === -1 ? nearestIndex(t, pool, note) : pool.indexOf(note));
      const step = pick([-2, -1, 1, 2], [1, 3, 3, 1], random);
      note = pool[Math.min(pool.length - 1, Math.max(0, i + step))] ?? note;
    }
    b.note(note, start + beat, len - 0.05, 'melody');
    beat += len;
  }
  return note;
}

function nearestIndex(t: Tuning, pool: number[], d: number): number {
  let best = 0;
  for (let i = 1; i < pool.length; i++) {
    if (Math.abs(intervalCents(t, d, pool[i])) < Math.abs(intervalCents(t, d, pool[best]))) best = i;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Comma pump

const PUMP = [
  { roman: 'I', type: 'major' },
  { roman: 'vi', type: 'minor' },
  { roman: 'ii', type: 'minor' },
  { roman: 'V', type: 'major' },
] as const;

/**
 * I–vi–ii–V repeated `cycles` times and closed with I. Each chord is built from the tuning's best
 * minor third down / fourth up, so a tuning that does not temper out 81/80 audibly drifts.
 * Returns null when the tuning has no usable octave, fourth or minor third.
 */
export function pumpScore(t: Tuning, cycles = 3): Score | null {
  const drift = pumpDrift(t);
  if (drift === null) return null;
  const fourth = approx(t, 4 / 3).steps;
  const minorThird = approx(t, 6 / 5).steps;
  const b = new ScoreBuilder();
  let prevUpper: number[] | null = null;
  let prevBass: number | null = null;

  const play = (fit: ChordFit, label: SectionLabel) => {
    b.section(label);
    const upper = voiceChord(t, chordDegrees(fit), prevUpper, UPPER_RANGE);
    upper.forEach((d, i) => b.note(d, b.time, 1.95, i === upper.length - 1 ? 'melody' : 'chord'));
    const bass = bassNote(t, fit.root, prevBass);
    b.note(bass, b.time, 1.95, 'bass');
    prevUpper = upper;
    prevBass = bass;
    b.time += 2;
  };

  let tonic = 0;
  for (let cycle = 1; cycle <= cycles; cycle++) {
    const roots = [tonic, tonic - minorThird, tonic - minorThird + fourth, tonic - minorThird + 2 * fourth];
    PUMP.forEach((step, i) => {
      const fit = fitChord(t, roots[i], chordType(step.type));
      if (!fit) return;
      play(fit, { key: 'gen.secPumpChord', params: { cycle, roman: step.roman, err: signed(chordError(fit)) } });
    });
    tonic += drift;
  }
  const final = fitChord(t, tonic, chordType('major'));
  if (final) {
    play(final, {
      key: 'gen.secPumpEnd',
      params: { cycles, steps: signed(cycles * drift, 0), cents: signed(intervalCents(t, 0, tonic)) },
    });
  }
  // Hold the last chord a little longer.
  for (const note of b.notes) if (note.start === b.time - 2) note.dur = 3.95;
  b.time += 2;
  return b.build();
}
