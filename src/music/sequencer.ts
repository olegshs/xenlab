import { create } from 'zustand';
import { engine, onPanic } from '../audio/instance';
import { useStore } from '../state/store';
import { freqOf } from '../tuning/frequency';
import { BEATS_PER_BAR, type Score, type SectionLabel } from './generator';

interface SequencerState {
  playing: boolean;
  /** Label of the section being heard right now. */
  section: SectionLabel | null;
  /** Another score is waiting for the next bar line (see `playNext`). */
  queued: boolean;
}

export const useSequencer = create<SequencerState>(() => ({ playing: false, section: null, queued: false }));

export interface PlayOptions {
  tempo: number;
  loop: boolean;
}

/** How far ahead notes are handed to the audio engine, in seconds. */
const LOOKAHEAD = 0.15;
const TICK_MS = 25;
const ID_PREFIX = 'seq:';

let score: Score | null = null;
let tempo = 90;
let loop = false;
/** AudioContext time of beat 0 of the current pass. */
let startTime = 0;
let noteIndex = 0;
let sectionIndex = 0;
/** Score to switch to, and the beat of the current pass where it starts. */
let pending: { score: Score; at: number } | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let sectionTimers: ReturnType<typeof setTimeout>[] = [];
let idCounter = 0;

const secondsPerBeat = () => 60 / tempo;

/**
 * Plays a score with the classic lookahead scheme: a timer hands upcoming notes to the engine
 * with exact AudioContext start/stop times, so timing does not depend on timer jitter.
 * Frequencies are taken from the current tuning at scheduling time.
 */
export function play(s: Score, options: PlayOptions) {
  stop();
  const ctx = engine.ensure();
  score = s;
  tempo = options.tempo;
  loop = options.loop;
  startTime = ctx.currentTime + 0.1;
  noteIndex = 0;
  sectionIndex = 0;
  useSequencer.setState({ playing: true, section: null, queued: false });
  timer = setInterval(tick, TICK_MS);
  tick();
}

/**
 * Switches to another score without a jump: the current one plays on to its next bar line
 * (or its end, if that comes first) and the new one starts there, on the beat.
 * Calling it again before the switch only replaces the waiting score. Starts at once when nothing is playing.
 */
export function playNext(s: Score, options: PlayOptions) {
  if (!score) {
    play(s, options);
    return;
  }
  setTempo(options.tempo);
  loop = options.loop;
  const beatNow = (engine.ensure().currentTime - startTime) / secondsPerBeat();
  // Notes before noteIndex are already in the engine, so the switch cannot come before the next one.
  const nextStart = score.notes[noteIndex]?.start ?? score.length;
  pending = { score: s, at: pending?.at ?? nextBarLine(Math.max(nextStart, beatNow), score.length) };
  useSequencer.setState({ queued: true });
}

/** The first bar line at or after `beat`, but no later than the end of the score. */
export function nextBarLine(beat: number, length: number, bar = BEATS_PER_BAR): number {
  return Math.min(length, Math.max(0, Math.ceil(beat / bar - 1e-9) * bar));
}

export function stop() {
  if (timer !== null) clearInterval(timer);
  timer = null;
  sectionTimers.forEach(clearTimeout);
  sectionTimers = [];
  score = null;
  pending = null;
  engine.stopWhere((id) => id.startsWith(ID_PREFIX));
  const state = useSequencer.getState();
  if (state.playing || state.queued) useSequencer.setState({ playing: false, section: null, queued: false });
}

/** Changes the tempo on the fly, keeping the current position in the score. */
export function setTempo(bpm: number) {
  if (!score || bpm === tempo) {
    tempo = bpm;
    return;
  }
  const now = engine.ensure().currentTime;
  const beat = (now - startTime) / secondsPerBeat();
  tempo = bpm;
  startTime = now - beat * secondsPerBeat();
}

export function setLoop(on: boolean) {
  loop = on;
}

/** Runs `fn` when AudioContext time `at` is reached (UI updates in step with the sound). */
function later(time: number, now: number, fn: () => void) {
  sectionTimers.push(setTimeout(fn, Math.max(0, (time - now) * 1000)));
}

function tick() {
  if (!score) return;
  const now = engine.ensure().currentTime;
  const horizon = now + LOOKAHEAD;
  const tuning = useStore.getState().tuning;

  for (;;) {
    const s: Score = score;
    const spb = secondsPerBeat();
    /** Notes and sections from this beat on are dropped in favour of the waiting score. */
    const cut = pending ? pending.at : Infinity;

    while (noteIndex < s.notes.length) {
      const note = s.notes[noteIndex];
      const time = startTime + note.start * spb;
      if (time > horizon || note.start >= cut) break;
      noteIndex++;
      if (time + note.dur * spb < now) continue; // fell behind (e.g. the tab was in the background)
      const id = `${ID_PREFIX}${idCounter++}`;
      engine.noteOn(id, note.degree, freqOf(tuning, note.degree), { when: time, gain: note.gain });
      engine.noteOff(id, { when: time + note.dur * spb, force: true });
    }

    while (sectionIndex < s.sections.length) {
      const section = s.sections[sectionIndex];
      const time = startTime + section.start * spb;
      if (time > horizon || section.start >= cut) break;
      sectionIndex++;
      later(time, now, () => useSequencer.setState({ section: section.label }));
    }

    if (pending && startTime + pending.at * spb <= horizon) {
      const switchTime = startTime + pending.at * spb;
      score = pending.score;
      pending = null;
      startTime = switchTime;
      noteIndex = 0;
      sectionIndex = 0;
      later(switchTime, now, () => useSequencer.setState({ queued: pending !== null }));
      continue;
    }

    const end = startTime + s.length * spb;
    const done = noteIndex >= s.notes.length && sectionIndex >= s.sections.length;
    if (done && loop && s.length > 0 && horizon >= end) {
      // Wrap before the end, so the first notes of the next pass are scheduled ahead like any other.
      startTime = end;
      noteIndex = 0;
      sectionIndex = 0;
      continue;
    }
    if (done && !loop && now >= end) stop();
    return;
  }
}

onPanic(stop);

// A different number of degrees or period makes the scheduled degrees meaningless: stop.
useStore.subscribe((s, prev) => {
  if (!score) return;
  if (s.tuning.stepsCents.length !== prev.tuning.stepsCents.length || s.tuning.periodCents !== prev.tuning.periodCents) {
    stop();
  }
});
