import type { Adsr } from './types';

const MIN = 0.001;

/** Starts attack/decay/sustain on a gain parameter. */
export function envStart(param: AudioParam, env: Adsr, peak: number, when: number) {
  const a = Math.max(env.attack, 0.002);
  param.cancelScheduledValues(when);
  param.setValueAtTime(0, when);
  param.linearRampToValueAtTime(peak, when + a);
  const sus = Math.max(env.sustain * peak, 0);
  param.setTargetAtTime(sus, when + a, Math.max(env.decay, 0.005) / 3);
}

/** Release from any envelope phase. Returns the end time. */
export function envRelease(param: AudioParam, env: Adsr, when: number): number {
  const r = Math.max(env.release, 0.01);
  const p = param as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam };
  if (typeof p.cancelAndHoldAtTime === 'function') {
    p.cancelAndHoldAtTime(when);
  } else {
    const current = param.value;
    param.cancelScheduledValues(when);
    param.setValueAtTime(current, when);
  }
  param.setTargetAtTime(MIN / 10, when, r / 5);
  return when + r * 1.2 + 0.05;
}
