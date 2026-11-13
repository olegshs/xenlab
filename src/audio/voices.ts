import { envRelease, envStart } from './envelope';
import type { Adsr, Sample, Voice } from './types';

interface VoiceCtx {
  ctx: AudioContext;
  out: AudioNode;
  env: Adsr;
  peak: number;
}

/** Oscillator (or PeriodicWave) → [lowpass] → envelope. */
export function oscillatorVoice(
  { ctx, out, env, peak }: VoiceCtx,
  freq: number,
  wave: OscillatorType | PeriodicWave,
  cutoff: number,
): Voice {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  if (wave instanceof PeriodicWave) osc.setPeriodicWave(wave);
  else osc.type = wave;
  osc.frequency.setValueAtTime(freq, now);

  const gain = ctx.createGain();
  gain.gain.value = 0;
  let filter: BiquadFilterNode | null = null;
  if (cutoff < 19000) {
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 0.7;
    osc.connect(filter).connect(gain);
  } else {
    osc.connect(gain);
  }
  gain.connect(out);
  envStart(gain.gain, env, peak, now);
  osc.start(now);

  const dispose = () => {
    try {
      osc.stop();
    } catch {
      /* already stopped */
    }
    osc.disconnect();
    filter?.disconnect();
    gain.disconnect();
  };
  osc.onended = dispose;

  return {
    setFreq(f, when) {
      osc.frequency.setTargetAtTime(f, when, 0.01);
    },
    release(when) {
      const end = envRelease(gain.gain, env, when);
      osc.stop(end);
      return end;
    },
    dispose,
  };
}

/** Plays the sample nearest in pitch with playbackRate = f / fSample. */
export function samplerVoice({ ctx, out, env, peak }: VoiceCtx, freq: number, samples: Sample[]): Voice | null {
  if (samples.length === 0) return null;
  let best = samples[0];
  for (const s of samples) {
    if (Math.abs(Math.log2(s.freq / freq)) < Math.abs(Math.log2(best.freq / freq))) best = s;
  }
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = best.buffer;
  src.playbackRate.setValueAtTime(freq / best.freq, now);
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(gain).connect(out);
  // Samples have their own natural attack/decay: use a short attack and full sustain.
  envStart(gain.gain, { ...env, attack: Math.min(env.attack, 0.01), sustain: 1 }, peak, now);
  src.start(now);

  const dispose = () => {
    try {
      src.stop();
    } catch {
      /* already stopped */
    }
    src.disconnect();
    gain.disconnect();
  };
  src.onended = dispose;
  const sampleFreq = best.freq;

  return {
    setFreq(f, when) {
      src.playbackRate.setTargetAtTime(f / sampleFreq, when, 0.01);
    },
    release(when) {
      const end = envRelease(gain.gain, env, when);
      src.stop(end);
      return end;
    },
    dispose,
  };
}
