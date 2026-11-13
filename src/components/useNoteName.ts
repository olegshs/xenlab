import { useMemo } from 'react';
import { useT } from '../i18n';
import { useStore } from '../state/store';
import { noteLabel } from '../tuning/noteNames';
import type { Nearest12 } from '../tuning/ratios';

/** Formats a 12-TET note with the chosen naming (letters or solfège in the UI language). */
export function useNoteName(): (note: Pick<Nearest12, 'pc' | 'octave'>) => string {
  const t = useT();
  const naming = useStore((s) => s.noteNaming);
  return useMemo(() => {
    const syllables = t('note.solfege').split(',');
    return ({ pc, octave }) => noteLabel(pc, octave, naming, syllables);
  }, [t, naming]);
}
