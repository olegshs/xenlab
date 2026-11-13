import { useSyncExternalStore } from 'react';
import { useStore } from '../state/store';
import { freqOf } from '../tuning/frequency';
import { AudioEngine } from './engine';

export const engine = new AudioEngine(useStore.getState().sound);

export const DRONE_ID = 'drone';

function syncDrone(on: boolean) {
  const { tuning } = useStore.getState();
  if (on) {
    if (!engine.isActive(DRONE_ID)) engine.noteOn(DRONE_ID, 0, freqOf(tuning, 0));
  } else {
    engine.noteOff(DRONE_ID, true);
  }
}

useStore.subscribe((s, prev) => {
  if (s.sound !== prev.sound) engine.setSettings(s.sound);
  if (s.tuning !== prev.tuning) engine.retune((d) => freqOf(s.tuning, d));
  if (s.drone !== prev.drone) syncDrone(s.drone);
});

/** Panic: silence and switch the drone off. */
export function panic() {
  engine.allOff();
  useStore.getState().setDrone(false);
}

export function useEngine() {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot);
}
