import { useEffect } from 'react';
import { engine, panic } from '../audio/instance';
import { useStore } from '../state/store';
import { freqOf } from '../tuning/frequency';
import { buildKeyMap, type LayoutSettings } from './mapping';

const TEXT_INPUTS = new Set(['text', 'number', 'search', 'email', 'url', 'tel', 'password']);

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  return el instanceof HTMLInputElement && TEXT_INPUTS.has(el.type);
}

let cache: { layout: LayoutSettings; map: Map<string, number> } | null = null;
function keyMap(layout: LayoutSettings) {
  if (cache?.layout !== layout) cache = { layout, map: buildKeyMap(layout) };
  return cache.map;
}

export const keyVoiceId = (code: string) => `key:${code}`;

/** Global playing from the computer keyboard. */
export function useKeyboard() {
  useEffect(() => {
    const held = new Set<string>();

    const down = (e: KeyboardEvent) => {
      if (isEditable(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const st = useStore.getState();
      const n = st.tuning.stepsCents.length;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          engine.ensure();
          engine.setSustain(true);
          return;
        case 'Escape':
          held.clear();
          panic();
          return;
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown': {
          e.preventDefault();
          const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: n, ArrowDown: -n }[e.code];
          st.transposeBy(step);
          return;
        }
      }
      const degree = keyMap(st.layout).get(e.code);
      if (degree === undefined) return;
      e.preventDefault();
      if (e.repeat || held.has(e.code)) return;
      held.add(e.code);
      engine.noteOn(keyVoiceId(e.code), degree, freqOf(st.tuning, degree));
    };

    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (!isEditable(e.target)) e.preventDefault();
        engine.setSustain(false);
        return;
      }
      if (held.delete(e.code)) engine.noteOff(keyVoiceId(e.code));
    };

    const blur = () => {
      held.clear();
      engine.setSustain(false);
      engine.releaseHeld();
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
}
