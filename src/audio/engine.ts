import { loadCustomSample, loadPiano } from './samples';
import type { Sample, SoundSettings, Voice } from './types';
import { oscillatorVoice, samplerVoice } from './voices';

interface Active {
  voice: Voice;
  degree: number;
  /** The key is physically held (false: sounding only because of sustain). */
  held: boolean;
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
    for (const [id, a] of this.voices) active.set(id, a.degree);
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

  private createVoice(freq: number): Voice | null {
    const ctx = this.ensure();
    const s = this.settings;
    const vc = { ctx, out: this.master!, env: s, peak: VOICE_PEAK };
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
  noteOn(id: string, degree: number, freq: number) {
    if (!Number.isFinite(freq) || freq <= 0 || freq > 22000) return;
    const prev = this.voices.get(id);
    if (prev) this.releaseVoice(prev.voice);
    const voice = this.createVoice(freq);
    if (!voice) return;
    this.voices.set(id, { voice, degree, held: true });
    this.emit();
  }

  noteOff(id: string, force = false) {
    const a = this.voices.get(id);
    if (!a) return;
    if (this.sustain && !force) {
      a.held = false;
      return;
    }
    this.voices.delete(id);
    this.releaseVoice(a.voice);
    this.emit();
  }

  isActive(id: string) {
    return this.voices.has(id);
  }

  private releaseVoice(v: Voice) {
    if (!this.ctx) return;
    const end = v.release(this.ctx.currentTime);
    this.releasing.add(v);
    setTimeout(() => this.releasing.delete(v), (end - this.ctx.currentTime) * 1000 + 100);
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
