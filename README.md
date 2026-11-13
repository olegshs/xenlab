# XenLab

A microtonal sandbox in the browser: build any tuning – 19-EDO, 31-EDO, Bohlen–Pierce, just intonation, a Scala file or your own list of ratios – and play it from your computer keyboard. Everything runs locally in the browser with the Web Audio API.

## Features

- **Tunings**
  - N-EDO (equal divisions of the octave) and EDx (equal divisions of any interval, e.g. 13 steps of 3/1)
  - Your own list of degrees in cents or ratios, and import/export of Scala `.scl` files
  - Built-in presets: 5, 7, 12, 17, 19, 22, 24, 31, 41, 53 and 72-EDO, Bohlen–Pierce, 5-limit just intonation, Pythagorean and harmonics 8–16
  - Adjust any degree in cents or Hz – for every octave or for a single note – and set the frequency of degree 0
- **Note table** with the step size, the nearest simple ratio and its error, and the nearest 12-TET note (letter names or solfège)
- **Playing**
  - Computer keyboard by physical key position, so it works with any keyboard layout (QWERTY, ЙЦУКЕН, Hebrew, Arabic, …)
  - Sequential layout (consecutive degrees across four rows) or isomorphic layout (Wicki–Hayden, chromatic or custom steps)
  - Mouse and touch on the on-screen keyboard, sustain, transpose, a reference drone and a panic button
- **Sound**: oscillator with ADSR and a lowpass filter, additive synthesis with 16 harmonics, sampled piano or your own sample
- **Generator**
  - *Tuning demo*: scale, characteristic intervals and every chord the tuning plays well
  - *Pieces*: seeded chord progressions with a melody, as a chorale or arpeggios
  - *Comma pump*: I–vi–ii–V–I from pure intervals, to hear whether the tuning tempers out 81/80
- **Presets**: save tunings and layouts in the browser, export/import JSON
- **Interface** in 11 languages (including right-to-left Hebrew and Arabic), light/dark/auto theme and a reset to defaults

## Keyboard shortcuts

| Key | Action |
|---|---|
| Letter, digit and punctuation keys | Play notes |
| ← / → | Shift the layout by one degree |
| ↑ / ↓ | Shift the layout by one period (octave) |
| Space (hold) | Sustain |
| Esc | Silence everything and stop playback |

Shortcuts are ignored while a text field has focus.

## Getting started

Requires Node.js 20.19+ or 22.12+ (the Docker image uses Node.js 24).

```bash
npm ci
npm run dev
```

Then open http://localhost:5173. Browsers only start audio after a click or key press, so press **Enable sound** or any key first.

Other scripts:

| Command | What it does |
|---|---|
| `npm test` | Unit tests (Vitest): tuning math, Scala parsing, layouts, music theory, generators, translations |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Type-check and build the static site into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |

## Docker

The image builds the app (running the tests on the way) and serves it with unprivileged nginx on port 8080.

```bash
docker compose up -d --build
```

Open http://localhost:8080. To use another host port:

```bash
XENLAB_PORT=3000 docker compose up -d
```

Without Compose:

```bash
docker build -t xenlab .
docker run --rm -p 8080:8080 xenlab
```

`dist/` is plain static files, so any static host works as well.

## Project structure

```
src/
  tuning/      tuning model, generators (EDO, EDx, lists), Scala parser, ratios, note names, presets
  music/       chord theory, score generators (demo, piece, comma pump), lookahead sequencer
  audio/       Web Audio engine, voices, envelopes, sample loading
  keyboard/    physical key layouts and key-to-degree mapping
  components/  React UI panels
  state/       app state (zustand), persisted in localStorage
  i18n/        translations and language detection
  theme/       light/dark theme
```

### Adding a language

1. Copy `src/i18n/locales/en.ts` to a new file named after the language code and translate the values. TypeScript reports any missing or extra key.
2. Register it in `LANGS` in `src/i18n/index.ts`. The list is sorted alphabetically by the native name.
3. Run `npm test`: it checks that every locale has the same keys and placeholders as English.

## Credits

- Piano samples: Salamander Grand Piano by Alexander Holm, CC-BY 3.0. They are loaded at runtime from the Tone.js hosting at tonejs.github.io.
- The `.scl` format comes from [Scala](https://www.huygens-fokker.org/scala/) by Manuel Op de Coul. Its archive has thousands of tunings.

## License

Copyright (C) 2026 Oleg Bresler

XenLab is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

XenLab is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with this program (see [LICENSE](LICENSE)). If not, see <https://www.gnu.org/licenses/>.

Note that the AGPL also covers network use: if you run a modified version of XenLab as a public website, you must offer its users the corresponding source code.

The piano samples loaded at runtime are not part of this repository and remain under their own CC-BY 3.0 license.
