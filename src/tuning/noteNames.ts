export type NoteNaming = 'letters' | 'solfege';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
/** Pitch classes of the natural notes C D E F G A B. */
const NATURALS = [0, 2, 4, 5, 7, 9, 11];

/**
 * Name of a 12-TET note: pitch class 0..11 (0 = C) plus octave number.
 * Accidentals are spelled as sharps. `syllables` are the seven solfège names
 * Do Re Mi Fa Sol La Si in the UI language.
 */
export function noteLabel(pc: number, octave: number, naming: NoteNaming, syllables: readonly string[] = []): string {
  const p = ((pc % 12) + 12) % 12;
  const sharp = !NATURALS.includes(p);
  const step = NATURALS.indexOf(sharp ? p - 1 : p);
  const base = naming === 'solfege' && syllables[step] ? syllables[step] : LETTERS[step];
  return `${base}${sharp ? '♯' : ''}${octave}`;
}
