import { create } from 'zustand';
import { engine, onPanic } from '../audio/instance';
import { useStore } from '../state/store';
import { freqOf } from '../tuning/frequency';
import type { Score, SectionLabel } from './generator';

interface SequencerState {
  playing: boolean;
  /** Label of the section being heard right now. */
  section: SectionLabel | null;
}

export const useSequencer = create<SequencerState>(() => ({ playing: false, section: null }));

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
let timer: ReturnType<typeof setInterval> | null = null;
let sectionTimers: ReturnType<typeof setTimeout>[] = [];
let idCounter = 0;

const secondsPerBeat = () => 60 / tempo;

/**
 * Plays a score with the classic lookahead scheme: a timer hands upcoming notes to the engine
 * with exact AudioContext start/stop times, so timing does not depend on timer jitter.
 * Frequencies are taken from the current tuning at scheduling time.
 */
export function play(s: Score, options: { tempo: number; loop: boolean }) {
  stop();
  const ctx = engine.ensure();
  score = s;
  tempo = options.tempo;
  loop = options.loop;
  startTime = ctx.currentTime + 0.1;
  noteIndex = 0;
  sectionIndex = 0;
  useSequencer.setState({ playing: true, section: null });
  timer = setInterval(tick, TICK_MS);
  tick();
}

export function stop() {
  if (timer !== null) clearInterval(timer);
  timer = null;
  sectionTimers.forEach(clearTimeout);
  sectionTimers = [];
  score = null;
  engine.stopWhere((id) => id.startsWith(ID_PREFIX));
  if (useSequencer.getState().playing) useSequencer.setState({ playing: false, section: null });
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

function tick() {
  if (!score) return;
  const ctx = engine.ensure();
  const now = ctx.currentTime;
  const horizon = now + LOOKAHEAD;
  const spb = secondsPerBeat();
  const tuning = useStore.getState().tuning;

  while (noteIndex < score.notes.length) {
    const note = score.notes[noteIndex];
    const at = startTime + note.start * spb;
    if (at > horizon) break;
    noteIndex++;
    if (at + note.dur * spb < now) continue; // fell behind (e.g. the tab was in the background)
    const id = `${ID_PREFIX}${idCounter++}`;
    engine.noteOn(id, note.degree, freqOf(tuning, note.degree), { when: at, gain: note.gain });
    engine.noteOff(id, { when: at + note.dur * spb, force: true });
  }

  while (sectionIndex < score.sections.length) {
    const section = score.sections[sectionIndex];
    const at = startTime + section.start * spb;
    if (at > horizon) break;
    sectionIndex++;
    sectionTimers.push(
      setTimeout(() => useSequencer.setState({ section: section.label }), Math.max(0, (at - now) * 1000)),
    );
  }

  const end = startTime + score.length * spb;
  if (noteIndex >= score.notes.length && sectionIndex >= score.sections.length && now >= end) {
    if (loop) {
      startTime = end;
      noteIndex = 0;
      sectionIndex = 0;
    } else {
      stop();
    }
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
