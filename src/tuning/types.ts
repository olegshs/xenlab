export type TuningSource =
  | { kind: 'edo'; n: number }
  | { kind: 'edx'; n: number; interval: string }
  | { kind: 'scala' }
  | { kind: 'custom' };

export interface Tuning {
  name: string;
  description?: string;
  /** Degrees within one period, in cents above degree 0; stepsCents[0] === 0. Length = N. */
  stepsCents: number[];
  /** Period size in cents (1200 = octave). */
  periodCents: number;
  /** Frequency of degree 0 (absolute note 0), Hz. */
  baseFreq: number;
  /** Manual per-degree adjustment in cents, repeated in every period. Key: degree class 0..N-1. */
  offsets: Record<number, number>;
  /** Fixed frequency for a specific absolute note, Hz. Key: absolute degree. */
  absOverrides: Record<number, number>;
  source: TuningSource;
}
