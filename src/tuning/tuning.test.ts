import { describe, expect, it } from 'vitest';
import { centsOf, freqOf, stepsForInterval } from './frequency';
import { C4, edo, edx, fromPitchList, fromScala } from './generators';
import { BUILTIN_TUNINGS, matchBuiltin } from './builtins';
import { noteLabel } from './noteNames';
import { approximateRatio, nearest12 } from './ratios';
import { parsePitch, parseScala, toScala } from './scala';

describe('EDO', () => {
  it('12-EDO gives standard pitches', () => {
    const t = edo(12);
    expect(freqOf(t, 9)).toBeCloseTo(440, 6); // A4
    expect(freqOf(t, 0)).toBeCloseTo(261.6256, 3); // C4
    expect(freqOf(t, 12)).toBeCloseTo(C4 * 2, 6);
    expect(freqOf(t, -12)).toBeCloseTo(C4 / 2, 6);
    expect(freqOf(t, -3)).toBeCloseTo(220, 6); // A3
  });

  it('31-EDO fifth is ~696.77 cents', () => {
    const t = edo(31);
    expect(centsOf(t, 18)).toBeCloseTo(696.774, 2);
    expect(stepsForInterval(t, 701.955)).toBe(18);
  });

  it('applies offsets per class and abs overrides', () => {
    const t = edo(12);
    t.offsets[7] = 2;
    expect(centsOf(t, 7)).toBeCloseTo(702);
    expect(centsOf(t, 19)).toBeCloseTo(1902);
    t.absOverrides[19] = 777;
    expect(freqOf(t, 19)).toBe(777);
    expect(freqOf(t, 7)).toBeCloseTo(C4 * Math.pow(2, 702 / 1200));
  });
});

describe('EDx', () => {
  it('Bohlen-Pierce period is a tritave', () => {
    const t = edx(13, '3/1');
    expect(t.periodCents).toBeCloseTo(1901.955, 2);
    expect(freqOf(t, 13)).toBeCloseTo(C4 * 3, 6);
    expect(t.stepsCents).toHaveLength(13);
  });
});

describe('Scala', () => {
  it('parses pitches', () => {
    expect(parsePitch('3/2')).toBeCloseTo(701.955, 3);
    expect(parsePitch('2')).toBeCloseTo(1200);
    expect(parsePitch(' 100.0  ! comment')).toBe(100);
    expect(() => parsePitch('abc')).toThrow();
  });

  it('parses a file with comments', () => {
    const text = `! meantone.scl
!
1/4-comma meantone
 3
!
 193.157
 5/4
 2/1
`;
    const s = parseScala(text);
    expect(s.description).toBe('1/4-comma meantone');
    expect(s.pitches).toHaveLength(3);
    expect(s.pitches[1]).toBeCloseTo(386.314, 3);
    const t = fromScala(s, 'meantone');
    expect(t.stepsCents).toEqual([0, 193.157, s.pitches[1]]);
    expect(t.periodCents).toBeCloseTo(1200);
  });

  it('round-trips export', () => {
    const t = fromPitchList('x', ['9/8', '5/4', '3/2', '2/1']);
    const s = parseScala(toScala('x', t.stepsCents, t.periodCents));
    expect(s.pitches.map((c) => c.toFixed(3))).toEqual(
      [...t.stepsCents.slice(1), t.periodCents].map((c) => c.toFixed(3)),
    );
  });

  it('rejects bad count', () => {
    expect(() => parseScala('desc\n5\n100.0\n')).toThrow();
  });
});

describe('ratios', () => {
  it('finds simple ratios', () => {
    expect(approximateRatio(700)).toMatchObject({ p: 3, q: 2 });
    expect(approximateRatio(386)).toMatchObject({ p: 5, q: 4 });
    expect(approximateRatio(0)).toMatchObject({ p: 1, q: 1 });
    expect(approximateRatio(300)).toMatchObject({ p: 6, q: 5 });
    expect(approximateRatio(1100)).toMatchObject({ p: 15, q: 8 });
  });

  it('names 12-TET notes', () => {
    expect(nearest12(440)).toMatchObject({ name: 'A4', pc: 9, octave: 4 });
    expect(nearest12(C4).name).toBe('C4');
    expect(nearest12(C4 / 2 * Math.pow(2, 1 / 12)).name).toBe('C♯3');
    expect(nearest12(445).deviation).toBeCloseTo(19.56, 1);
  });
});

describe('note names', () => {
  const ru = ['До', 'Ре', 'Ми', 'Фа', 'Соль', 'Ля', 'Си'];
  it('spells letters and solfège', () => {
    expect(noteLabel(0, 4, 'letters')).toBe('C4');
    expect(noteLabel(10, 3, 'letters')).toBe('A♯3');
    expect(noteLabel(7, 4, 'solfege', ru)).toBe('Соль4');
    expect(noteLabel(8, 5, 'solfege', ru)).toBe('Соль♯5');
    expect(noteLabel(11, 2, 'solfege', ru)).toBe('Си2');
    expect(noteLabel(-1, 2, 'letters')).toBe('B2');
  });

  it('falls back to letters without syllables', () => {
    expect(noteLabel(4, 4, 'solfege')).toBe('E4');
  });
});

describe('matchBuiltin', () => {
  it('recognises unmodified built-in tunings', () => {
    expect(matchBuiltin(edo(31))).toBe('edo-31');
    expect(matchBuiltin({ ...edo(12), name: 'renamed' })).toBe('edo-12');
    expect(matchBuiltin(edx(13, '3/1'))).toBe('bp');
    const ji = BUILTIN_TUNINGS.find((b) => b.id === 'ji5')!.make();
    expect(matchBuiltin(JSON.parse(JSON.stringify(ji)))).toBe('ji5');
  });

  it('stops matching once the tuning is changed', () => {
    expect(matchBuiltin({ ...edo(31), offsets: { 18: 5 } })).toBeNull();
    expect(matchBuiltin({ ...edo(31), absOverrides: { 3: 300 } })).toBeNull();
    expect(matchBuiltin(edo(31, 440))).toBeNull();
    expect(matchBuiltin(edo(23))).toBeNull();
  });
});
