import { AppError } from '../errors';
import type { Sample } from './types';

/** Salamander Grand Piano (Alexander Holm, CC-BY 3.0), hosted by Tone.js. */
export const PIANO_BASE_URL = 'https://tonejs.github.io/audio/salamander/';

const PC: Record<string, number> = { C: 0, Ds: 3, Fs: 6, A: 9 };

function pianoNotes(): { file: string; freq: number }[] {
  const out: { file: string; freq: number }[] = [];
  const push = (name: string, oct: number) => {
    const midi = 12 * (oct + 1) + PC[name];
    out.push({ file: `${name}${oct}.mp3`, freq: 440 * Math.pow(2, (midi - 69) / 12) });
  };
  push('A', 0);
  for (let oct = 1; oct <= 7; oct++) for (const n of ['C', 'Ds', 'Fs', 'A']) push(n, oct);
  push('C', 8);
  return out;
}

export async function loadPiano(ctx: AudioContext, onProgress?: (done: number, total: number) => void): Promise<Sample[]> {
  const notes = pianoNotes();
  let done = 0;
  const results = await Promise.all(
    notes.map(async ({ file, freq }) => {
      const res = await fetch(PIANO_BASE_URL + file);
      if (!res.ok) throw new AppError('err.sampleHttp', { file, status: res.status });
      const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
      onProgress?.(++done, notes.length);
      return { freq, buffer };
    }),
  );
  return results.sort((a, b) => a.freq - b.freq);
}

export async function loadCustomSample(ctx: AudioContext, file: File, rootFreq: number): Promise<Sample> {
  const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
  return { freq: rootFreq, buffer };
}
