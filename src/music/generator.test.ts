import { describe, expect, it } from 'vitest';
import { BUILTIN_TUNINGS } from '../tuning/builtins';
import { degreeClass } from '../tuning/frequency';
import { edo, edx } from '../tuning/generators';
import { demoScore, pieceScore, pumpScore, type Score } from './generator';

function checkScore(s: Score, label: string) {
  expect(s.notes.length, label).toBeGreaterThan(0);
  expect(s.length, label).toBeGreaterThan(0);
  for (let i = 1; i < s.notes.length; i++) expect(s.notes[i].start, label).toBeGreaterThanOrEqual(s.notes[i - 1].start);
  for (const n of s.notes) {
    expect(Number.isInteger(n.degree), label).toBe(true);
    expect(n.dur, label).toBeGreaterThan(0);
    expect(n.start + n.dur, label).toBeLessThanOrEqual(s.length + 1e-9);
    expect(n.gain, label).toBeGreaterThan(0);
  }
  for (let i = 1; i < s.sections.length; i++) {
    expect(s.sections[i].start, label).toBeGreaterThanOrEqual(s.sections[i - 1].start);
  }
}

describe('demoScore', () => {
  it('works for every built-in tuning', () => {
    for (const b of BUILTIN_TUNINGS) checkScore(demoScore(b.make()), b.id);
  });

  it('starts with the scale and includes chords', () => {
    const s = demoScore(edo(31));
    expect(s.sections[0].label.key).toBe('gen.secScale');
    expect(s.sections.some((x) => x.label.key === 'gen.secChord' && x.label.keyParams?.name === 'chord.harm7')).toBe(true);
  });
});

describe('pieceScore', () => {
  const opts = { seed: 7, bars: 8, texture: 'chorale' as const };

  it('is reproducible for the same seed', () => {
    expect(pieceScore(edo(19), opts)).toEqual(pieceScore(edo(19), opts));
    expect(pieceScore(edo(19), opts)).not.toEqual(pieceScore(edo(19), { ...opts, seed: 8 }));
  });

  it('has one chord per bar and ends on the tonic', () => {
    for (const texture of ['chorale', 'arpeggio'] as const) {
      const t = edo(12);
      const s = pieceScore(t, { ...opts, texture });
      expect(s.length).toBe(32);
      expect(s.sections.filter((x) => x.label.key === 'gen.secPieceChord')).toHaveLength(8);
      const lastBass = s.notes.filter((n) => n.part === 'bass').at(-1)!;
      expect(degreeClass(12, lastBass.degree)).toBe(0);
    }
  });

  it('works for every built-in tuning, texture and many seeds', () => {
    for (const b of BUILTIN_TUNINGS) {
      const t = b.make();
      for (const texture of ['chorale', 'arpeggio'] as const) {
        for (let seed = 1; seed <= 5; seed++) checkScore(pieceScore(t, { seed, bars: 8, texture }), `${b.id}/${texture}/${seed}`);
      }
    }
  });
});

describe('pumpScore', () => {
  it('returns to the tonic in 12-EDO', () => {
    const s = pumpScore(edo(12))!;
    checkScore(s, '12');
    expect(s.sections.at(-1)!.label.params?.steps).toBe('+0');
  });

  it('drifts in 22-EDO', () => {
    const s = pumpScore(edo(22))!;
    expect(s.sections.at(-1)!.label.params?.steps).toBe('−3');
  });

  it('is unavailable for Bohlen–Pierce', () => {
    expect(pumpScore(edx(13, '3/1'))).toBeNull();
  });
});
