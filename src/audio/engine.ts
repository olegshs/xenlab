import { loadCustomSample, loadPiano } from './samples';
import type { Sample, SoundSettings, Voice } from './types';
import { oscillatorVoice, samplerVoice } from './voices';

interface Active {
  voice: Voice;
  degree: number;
  /** The key is physically held (false: sounding only because of sustain). */
  held: boolean;
  /** AudioContext time the note starts (later than now for scheduled notes). */
  startAt: number;
  /** AudioContext time of a scheduled release, if any. */
  endAt?: number;
}

export interface NoteOnOptions {
  /** Start time on the AudioContext clock; defaults to now. */
  when?: number;
  /** Relative loudness, 0..1. */
  gain?: number;
}

export interface NoteOffOptions {
  /** Release time on the AudioContext clock; defaults to now. */
  when?: number;
  /** Release even while the sustain pedal is down. */
  force?: boolean;
}

export type SampleStatus =
  | { state: 'idle' }
  | { state: 'loading'; done: number; total: number }
  | { state: 'ready'; count: number }
  | { state: 'error'; error: unknown };

export interface EngineSnapshot {
  /** id → absolute degree for every sounding note (held or sustained). */
  active: ReadonlyMap<string, number>;
  sustain: boolean;
  piano: SampleStatus;
  custom: SampleStatus;
  running: boolean;
}

const VOICE_PEAK = 0.22;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Map<string, Active>();
  private releasing = new Set<Voice>();
  private sustain = false;
  private settings: SoundSettings;
  private wave: { key: string; wave: PeriodicWave } | null = null;
  private pianoSamples: Sample[] = [];
  private customSamples: Sample[] = [];
  private listeners = new Set<() => void>();
  private snapshot: EngineSnapshot;

  constructor(settings: SoundSettings) {
    this.settings = settings;
    this.snapshot = this.makeSnapshot({ state: 'idle' }, { state: 'idle' });
  }

  // ---------- subscription for React (useSyncExternalStore) ----------
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snapshot;

  private makeSnapshot(piano: SampleStatus, custom: SampleStatus): EngineSnapshot {
    const active = new Map<string, number>();
    // Scheduled notes count as sounding only between their start and release.
    const now = (this.ctx?.currentTime ?? 0) + 0.01;
    for (const [id, a] of this.voices) {
      if (a.startAt <= now && (a.endAt === undefined || a.endAt > now)) active.set(id, a.degree);
    }
    return { active, sustain: this.sustain, piano, custom, running: this.ctx?.state === 'running' };
  }
  private emit(patch: Partial<Pick<EngineSnapshot, 'piano' | 'custom'>> = {}) {
    this.snapshot = this.makeSnapshot(patch.piano ?? this.snapshot.piano, patch.custom ?? this.snapshot.custom);
    this.listeners.forEach((l) => l());
  }

  // ---------- context ----------
  /** Creates/resumes the AudioContext. Call from a user-gesture handler. */
  ensure(): AudioContext {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 6;
      comp.ratio.value = 12;
      comp.attack.value = 0.003;
      comp.release.value = 0.15;
      const master = ctx.createGain();
      master.gain.value = this.settings.volume;
      master.connect(comp).connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      ctx.onstatechange = () => this.emit();
      // Persisted "piano samples" setting: start loading right after the first gesture.
      if (this.settings.engine === 'sampler' && this.settings.sampleSource === 'piano') {
        queueMicrotask(() => void this.loadPiano());
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().then(() => this.emit());
    return this.ctx;
  }

  setSettings(s: SoundSettings) {
    this.settings = s;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(s.volume, this.ctx.currentTime, 0.02);
    if (s.engine === 'sampler' && s.sampleSource === 'piano' && this.snapshot.piano.state === 'idle' && this.ctx) {
      void this.loadPiano();
    }
  }

  private periodicWave(ctx: AudioContext): PeriodicWave {
    const key = this.settings.harmonics.join(',');
    if (this.wave?.key === key) return this.wave.wave;
    const h = this.settings.harmonics;
    const real = new Float32Array(h.length + 1);
    const imag = new Float32Array(h.length + 1);
    h.forEach((a, i) => (imag[i + 1] = a));
    if (h.every((a) => a === 0)) imag[1] = 1;
    const wave = ctx.createPeriodicWave(real, imag);
    this.wave = { key, wave };
    return wave;
  }

  private createVoice(freq: number, when?: number, gain = 1): Voice | null {
    const ctx = this.ensure();
    const s = this.settings;
    const vc = { ctx, out: this.master!, env: s, peak: VOICE_PEAK * gain, when };
    switch (s.engine) {
      case 'osc':
        return oscillatorVoice(vc, freq, s.wave, s.cutoff);
      case 'additive':
        return oscillatorVoice(vc, freq, this.periodicWave(ctx), 20000);
      case 'sampler': {
        const samples = s.sampleSource === 'piano' ? this.pianoSamples : this.customSamples;
        // Until samples are loaded, fall back to a triangle wave instead of silence.
        return samplerVoice(vc, freq, samples) ?? oscillatorVoice(vc, freq, 'triangle', 20000);
      }
    }
  }

  // ---------- notes ----------
  noteOn(id: string, degree: number, freq: number, { when, gain = 1 }: NoteOnOptions = {}) {
    if (!Number.isFinite(freq) || freq <= 0 || freq > 22000) return;
    const ctx = this.ensure();
    const prev = this.voices.get(id);
    if (prev) this.releaseVoice(prev.voice, when);
    const voice = this.createVoice(freq, when, gain);
    if (!voice) return;
    const startAt = Math.max(when ?? 0, ctx.currentTime);
    this.voices.set(id, { voice, degree, held: true, startAt });
    this.emitAt(startAt);
  }

  noteOff(id: string, { when, force = false }: NoteOffOptions = {}) {
    const a = this.voices.get(id);
    if (!a || !this.ctx) return;
    if (this.sustain && !force) {
      a.held = false;
      return;
    }
    const at = Math.max(when ?? 0, this.ctx.currentTime);
    if (at > this.ctx.currentTime + 0.005) {
      // Scheduled release: keep the note listed until then so highlighting stays in sync.
      a.endAt = at;
      this.releaseVoice(a.voice, at);
      setTimeout(() => {
        if (this.voices.get(id) === a) this.voices.delete(id);
        this.emit();
      }, (at - this.ctx.currentTime) * 1000);
      return;
    }
    this.voices.delete(id);
    this.releaseVoice(a.voice);
    this.emit();
  }

  isActive(id: string) {
    return this.voices.has(id);
  }

  /** Emits now, and again when a scheduled note actually starts. */
  private emitAt(time: number) {
    this.emit();
    const delay = this.ctx ? time - this.ctx.currentTime : 0;
    if (delay > 0.005) setTimeout(() => this.emit(), delay * 1000);
  }

  private releaseVoice(v: Voice, when?: number) {
    if (!this.ctx) return;
    const end = v.release(Math.max(when ?? 0, this.ctx.currentTime));
    this.releasing.add(v);
    setTimeout(() => this.releasing.delete(v), (end - this.ctx.currentTime) * 1000 + 100);
  }

  /** Stops notes whose id matches: sounding ones are released, not-yet-started ones are dropped. */
  stopWhere(match: (id: string) => boolean) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const [id, a] of this.voices) {
      if (!match(id)) continue;
      this.voices.delete(id);
      if (a.startAt > now + 0.005) a.voice.dispose();
      else this.releaseVoice(a.voice);
    }
    this.emit();
  }

  setSustain(on: boolean) {
    if (this.sustain === on) return;
    this.sustain = on;
    if (!on) {
      for (const [id, a] of this.voices) {
        if (!a.held) {
          this.voices.delete(id);
          this.releaseVoice(a.voice);
        }
      }
    }
    this.emit();
  }

  /** Updates the frequencies of sounding notes (after the tuning is edited). */
  retune(freqOf: (degree: number) => number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const a of this.voices.values()) a.voice.setFreq(freqOf(a.degree), t);
  }

  /** Panic: silence everything immediately. */
  allOff() {
    for (const a of this.voices.values()) a.voice.dispose();
    for (const v of this.releasing) v.dispose();
    this.voices.clear();
    this.releasing.clear();
    this.sustain = false;
    this.emit();
  }

  /** Releases all held keys (e.g. when the window loses focus). */
  releaseHeld() {
    for (const [id, a] of this.voices) {
      if (a.held && id !== 'drone') {
        this.voices.delete(id);
        this.releaseVoice(a.voice);
      }
    }
    this.emit();
  }

  // ---------- samples ----------
  async loadPiano() {
    const ctx = this.ensure();
    if (this.snapshot.piano.state === 'loading' || this.snapshot.piano.state === 'ready') return;
    this.emit({ piano: { state: 'loading', done: 0, total: 30 } });
    try {
      this.pianoSamples = await loadPiano(ctx, (done, total) =>
        this.emit({ piano: { state: 'loading', done, total } }),
      );
      this.emit({ piano: { state: 'ready', count: this.pianoSamples.length } });
    } catch (e) {
      this.emit({ piano: { state: 'error', error: e } });
    }
  }

  async loadCustom(file: File, rootFreq: number) {
    const ctx = this.ensure();
    this.emit({ custom: { state: 'loading', done: 0, total: 1 } });
    try {
      this.customSamples = [await loadCustomSample(ctx, file, rootFreq)];
      this.emit({ custom: { state: 'ready', count: 1 } });
    } catch (e) {
      this.emit({ custom: { state: 'error', error: e } });
    }
  }

  setCustomRoot(rootFreq: number) {
    this.customSamples = this.customSamples.map((s) => ({ ...s, freq: rootFreq }));
  }
}
