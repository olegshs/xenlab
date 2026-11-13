import { describe, expect, it } from 'vitest';
import { BUILTIN_TUNINGS } from '../tuning/builtins';
import { edo, edx } from '../tuning/generators';
import { availableChords, buildScale, chordDegrees, movementWeight, pumpDrift, rng } from './theory';

const ids = (fits: { type: { id: string } }[]) => fits.map((f) => f.type.id);

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = rng(42);
    const b = rng(42);
    const xs = Array.from({ length: 5 }, () => a());
    expect(xs).toEqual(Array.from({ length: 5 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(rng(43)()).not.toBe(xs[0]);
  });
});

describe('availableChords', () => {
  it('12-EDO has major and minor but no 4:5:6:7', () => {
    const chords = availableChords(edo(12));
    expect(ids(chords)).toContain('major');
    expect(ids(chords)).toContain('minor');
    expect(ids(chords)).not.toContain('harm7');
    expect(chordDegrees(chords[0])).toEqual([0, 4, 7]);
  });

  it('31-EDO plays 4:5:6:7 almost purely', () => {
    const harm7 = availableChords(edo(31)).find((c) => c.type.id === 'harm7')!;
    expect(harm7.steps).toEqual([10, 18, 25]);
    expect(harm7.maxError).toBeLessThan(6);
  });

  it('Bohlen–Pierce plays its 3:5:7 triad', () => {
    const chords = availableChords(edx(13, '3/1'));
    expect(ids(chords)).toContain('bp');
    expect(ids(chords)).not.toContain('major');
  });

  it('falls back to approximate chords in 5-EDO', () => {
    const chords = availableChords(edo(5));
    expect(chords.length).toBeGreaterThan(0);
  });

  it('never returns duplicate step patterns', () => {
    for (const b of BUILTIN_TUNINGS) {
      const keys = availableChords(b.make()).map((c) => c.steps.join(','));
      expect(new Set(keys).size, b.id).toBe(keys.length);
    }
  });
});

describe('buildScale', () => {
  it('builds diatonic scales from the chain of fifths', () => {
    expect(buildScale(edo(12))).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(buildScale(edo(19))).toEqual([0, 3, 6, 8, 11, 14, 17]);
    expect(buildScale(edo(31))).toEqual([0, 5, 10, 13, 18, 23, 28]);
  });

  it('uses all degrees for small or non-octave tunings', () => {
    expect(buildScale(edo(5))).toEqual([0, 1, 2, 3, 4]);
    expect(buildScale(edx(13, '3/1'))).toHaveLength(13);
  });

  it('always returns sorted degree classes for built-in tunings', () => {
    for (const b of BUILTIN_TUNINGS) {
      const t = b.make();
      const s = buildScale(t);
      expect(s.length, b.id).toBeGreaterThanOrEqual(5);
      expect([...s].sort((x, y) => x - y)).toEqual(s);
      expect(s.every((d) => d >= 0 && d < t.stepsCents.length)).toBe(true);
    }
  });
});

describe('movementWeight', () => {
  it('prefers fifths over seconds', () => {
    const t = edo(12);
    expect(movementWeight(t, 0, 7)).toBeGreaterThan(movementWeight(t, 0, 2));
    expect(movementWeight(t, 0, 0)).toBe(0);
  });
});

describe('pumpDrift', () => {
  it('is zero for meantone-compatible tunings', () => {
    expect(pumpDrift(edo(12))).toBe(0);
    expect(pumpDrift(edo(19))).toBe(0);
    expect(pumpDrift(edo(31))).toBe(0);
  });

  it('drifts in tunings that do not temper out 81/80', () => {
    expect(pumpDrift(edo(22))).toBe(-1);
    expect(pumpDrift(edo(53))).toBe(-1);
  });

  it('is unavailable without an octave', () => {
    expect(pumpDrift(edx(13, '3/1'))).toBeNull();
  });
});
