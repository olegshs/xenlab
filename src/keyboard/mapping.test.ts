import { describe, expect, it } from 'vitest';
import { edo } from '../tuning/generators';
import { KEY_BY_CODE } from './layouts';
import { buildKeyMap, isoPresetSteps, keyDegree, type LayoutSettings } from './mapping';

const base: LayoutSettings = { mode: 'sequential', stepRight: 1, stepUpRight: 4, isoPreset: 'custom', transpose: 0 };
const key = (c: string) => KEY_BY_CODE.get(c)!;

describe('sequential layout', () => {
  it('runs Z-row, A-row, Q-row, digits', () => {
    expect(keyDegree(key('KeyZ'), base)).toBe(0);
    expect(keyDegree(key('Slash'), base)).toBe(9);
    expect(keyDegree(key('KeyA'), base)).toBe(10);
    expect(keyDegree(key('KeyQ'), base)).toBe(21);
    expect(keyDegree(key('Digit1'), base)).toBe(33);
    expect(keyDegree(key('Equal'), base)).toBe(44);
  });

  it('applies transpose', () => {
    expect(buildKeyMap({ ...base, transpose: -5 }).get('KeyZ')).toBe(-5);
  });
});

describe('isomorphic layout', () => {
  it('Wicki-Hayden in 12-EDO', () => {
    const steps = isoPresetSteps(edo(12), 'wicki')!;
    expect(steps).toEqual({ stepRight: 2, stepUpRight: 7 });
    const s: LayoutSettings = { ...base, mode: 'isomorphic', ...steps };
    expect(keyDegree(key('KeyZ'), s)).toBe(0);
    expect(keyDegree(key('KeyX'), s)).toBe(2); // whole tone to the right
    expect(keyDegree(key('KeyS'), s)).toBe(7); // fifth up-right
    expect(keyDegree(key('KeyA'), s)).toBe(5); // fourth up-left
  });

  it('31-EDO presets', () => {
    expect(isoPresetSteps(edo(31), 'wicki')).toEqual({ stepRight: 5, stepUpRight: 18 });
    expect(isoPresetSteps(edo(31), 'chromatic')).toEqual({ stepRight: 1, stepUpRight: 10 });
  });
});
