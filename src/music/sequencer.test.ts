import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Score } from './generator';
import { nextBarLine, play, playNext, stop, useSequencer } from './sequencer';

// vi.mock is hoisted above the imports. A fake engine whose clock is moved by hand, so scheduling can be checked without Web Audio.
const h = vi.hoisted(() => ({
  clock: 0,
  /** degree, requested start time, and the clock when the note was handed over */
  notes: [] as { degree: number; when: number; handedAt: number }[],
}));

vi.mock('../audio/instance', () => ({
  engine: {
    ensure: () => ({ currentTime: h.clock }),
    noteOn: (_id: string, degree: number, _freq: number, opts: { when: number }) =>
      h.notes.push({ degree, when: opts.when, handedAt: h.clock }),
    noteOff: () => {},
    stopWhere: () => {},
  },
  onPanic: () => () => {},
}));

vi.mock('../state/store', async () => {
  const { edo } = await import('../tuning/generators');
  const tuning = edo(12);
  return { useStore: { getState: () => ({ tuning }), subscribe: () => () => {} } };
});

/** One note per beat on `degree`, `beats` long. */
function beats(degree: number, count: number): Score {
  return {
    notes: Array.from({ length: count }, (_, i) => ({ degree, start: i, dur: 0.9, part: 'melody' as const, gain: 1 })),
    sections: [],
    length: count,
  };
}

/** Moves the clock forward in timer-sized steps. */
function advance(seconds: number) {
  for (let i = 0; i < Math.round(seconds / 0.025); i++) {
    h.clock += 0.025;
    vi.advanceTimersByTime(25);
  }
}

const whens = (degree: number) => h.notes.filter((n) => n.degree === degree).map((n) => +n.when.toFixed(3));

// At 60 BPM a beat is one second; play() starts beat 0 at clock + 0.1.
const OPTS = { tempo: 60, loop: false };

beforeEach(() => {
  vi.useFakeTimers();
  h.clock = 0;
  h.notes = [];
});

afterEach(() => {
  stop();
  vi.useRealTimers();
});

describe('nextBarLine', () => {
  it('rounds up to a bar line and stops at the end of the score', () => {
    expect(nextBarLine(0, 32)).toBe(0);
    expect(nextBarLine(1.5, 32)).toBe(4);
    expect(nextBarLine(4, 32)).toBe(4);
    expect(nextBarLine(4.5, 32)).toBe(8);
    expect(nextBarLine(29, 30)).toBe(30);
  });
});

describe('sequencer', () => {
  it('finishes the current bar before switching to the next score', () => {
    play(beats(1, 8), OPTS);
    advance(1.6); // beat 1.5
    playNext(beats(2, 8), OPTS);
    expect(useSequencer.getState().queued).toBe(true);
    advance(10);
    expect(whens(1)).toEqual([0.1, 1.1, 2.1, 3.1]);
    expect(whens(2).slice(0, 3)).toEqual([4.1, 5.1, 6.1]);
    expect(useSequencer.getState().queued).toBe(false);
  });

  it('hands every note to the engine ahead of time', () => {
    play(beats(1, 4), { tempo: 60, loop: true });
    advance(2.6);
    playNext(beats(2, 4), { tempo: 60, loop: true });
    advance(6);
    expect(whens(2).slice(0, 2)).toEqual([4.1, 5.1]);
    expect(h.notes.every((n) => n.when > n.handedAt)).toBe(true);
  });

  it('keeps the switch point when asked again and plays only the latest score', () => {
    play(beats(1, 8), OPTS);
    advance(1.6);
    playNext(beats(2, 8), OPTS);
    advance(1);
    playNext(beats(3, 8), OPTS);
    advance(6);
    expect(whens(2)).toEqual([]);
    expect(whens(3)[0]).toBe(4.1);
  });

  it('waits for the following bar once the bar line is already scheduled', () => {
    play(beats(1, 8), OPTS);
    advance(4); // 0.1 s before beat 4, which is already within the lookahead
    playNext(beats(2, 8), OPTS);
    advance(6);
    expect(whens(1)).toEqual([0.1, 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1]);
    expect(whens(2)[0]).toBe(8.1);
  });

  it('switches at the end when the score ends before the next bar line', () => {
    play(beats(1, 6), OPTS);
    advance(4.6); // beat 4.5 of 6
    playNext(beats(2, 4), OPTS);
    advance(4);
    expect(whens(1)).toEqual([0.1, 1.1, 2.1, 3.1, 4.1, 5.1]);
    expect(whens(2)[0]).toBe(6.1);
  });

  it('wraps a loop seamlessly', () => {
    play(beats(1, 4), { tempo: 60, loop: true });
    advance(9);
    expect(whens(1).slice(0, 9)).toEqual([0.1, 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1]);
    expect(h.notes.every((n) => n.when > n.handedAt)).toBe(true);
  });

  it('starts at once when nothing is playing', () => {
    playNext(beats(2, 4), OPTS);
    expect(useSequencer.getState()).toMatchObject({ playing: true, queued: false });
    expect(whens(2)[0]).toBe(0.1);
  });

  it('stops at the end without a loop', () => {
    play(beats(1, 2), OPTS);
    advance(3);
    expect(useSequencer.getState().playing).toBe(false);
  });
});
