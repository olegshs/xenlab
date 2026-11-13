export type EngineKind = 'osc' | 'additive' | 'sampler';

export interface Adsr {
  attack: number; // s
  decay: number; // s
  sustain: number; // 0..1
  release: number; // s
}

export interface SoundSettings extends Adsr {
  engine: EngineKind;
  wave: OscillatorType;
  /** Lowpass cutoff for the oscillator, Hz (20000 = off). */
  cutoff: number;
  /** Amplitudes of harmonics 1..16 for additive synthesis. */
  harmonics: number[];
  sampleSource: 'piano' | 'custom';
  volume: number; // 0..1
}

export interface Voice {
  setFreq(freq: number, when: number): void;
  /** Starts the release; returns the time the voice falls silent. */
  release(when: number): number;
  /** Immediate stop and node disconnection. */
  dispose(): void;
}

export interface Sample {
  freq: number;
  buffer: AudioBuffer;
}
