export interface PhysKey {
  code: string;
  /** Label on a US QWERTY keyboard. */
  label: string;
  /** Index of the key within its row. */
  col: number;
  /** Row from bottom to top: 0 = Z row, 3 = digits. */
  row: number;
}

/** Row offset relative to the digit row (in key widths), as on a regular keyboard. */
export const ROW_OFFSET = [1.25, 0.75, 0.5, 0];

const ROWS: [string, string][][] = [
  [
    ['KeyZ', 'Z'], ['KeyX', 'X'], ['KeyC', 'C'], ['KeyV', 'V'], ['KeyB', 'B'],
    ['KeyN', 'N'], ['KeyM', 'M'], ['Comma', ','], ['Period', '.'], ['Slash', '/'],
  ],
  [
    ['KeyA', 'A'], ['KeyS', 'S'], ['KeyD', 'D'], ['KeyF', 'F'], ['KeyG', 'G'],
    ['KeyH', 'H'], ['KeyJ', 'J'], ['KeyK', 'K'], ['KeyL', 'L'], ['Semicolon', ';'], ['Quote', "'"],
  ],
  [
    ['KeyQ', 'Q'], ['KeyW', 'W'], ['KeyE', 'E'], ['KeyR', 'R'], ['KeyT', 'T'], ['KeyY', 'Y'],
    ['KeyU', 'U'], ['KeyI', 'I'], ['KeyO', 'O'], ['KeyP', 'P'], ['BracketLeft', '['], ['BracketRight', ']'],
  ],
  [
    ['Digit1', '1'], ['Digit2', '2'], ['Digit3', '3'], ['Digit4', '4'], ['Digit5', '5'], ['Digit6', '6'],
    ['Digit7', '7'], ['Digit8', '8'], ['Digit9', '9'], ['Digit0', '0'], ['Minus', '-'], ['Equal', '='],
  ],
];

/** Rows from top to bottom (for rendering). */
export const KEY_ROWS: PhysKey[][] = ROWS.map((r, row) => r.map(([code, label], col) => ({ code, label, col, row }))).reverse();

export const ALL_KEYS: PhysKey[] = KEY_ROWS.flat();

export const KEY_BY_CODE = new Map(ALL_KEYS.map((k) => [k.code, k]));

/** Letter keys in QWERTY order: Q row, A row, Z row. */
const LETTER_CODES = [
  'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight',
  'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote',
  'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash',
];

const zipLabels = (labels: string[]) => new Map(LETTER_CODES.map((c, i) => [c, labels[i]]));

/**
 * Secondary key labels for languages with a non-Latin keyboard layout,
 * so users see the letter printed on their own keys.
 */
export const NATIVE_LABELS: Record<string, Map<string, string>> = {
  ru: zipLabels([
    'Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х', 'Ъ',
    'Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э',
    'Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю', '.',
  ]),
  he: zipLabels([
    '/', "'", 'ק', 'ר', 'א', 'ט', 'ו', 'ן', 'ם', 'פ', ']', '[',
    'ש', 'ד', 'ג', 'כ', 'ע', 'י', 'ח', 'ל', 'ך', 'ף', ',',
    'ז', 'ס', 'ב', 'ה', 'נ', 'מ', 'צ', 'ת', 'ץ', '.',
  ]),
  ar: zipLabels([
    'ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د',
    'ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط',
    'ئ', 'ء', 'ؤ', 'ر', 'لا', 'ى', 'ة', 'و', 'ز', 'ظ',
  ]),
};
