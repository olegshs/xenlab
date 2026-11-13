import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SoundSettings } from '../audio/types';
import { ALL_KEYS } from '../keyboard/layouts';
import { isoPresetSteps, keyDegree, type LayoutSettings } from '../keyboard/mapping';
import { edo } from '../tuning/generators';
import type { NoteNaming } from '../tuning/noteNames';
import type { Tuning } from '../tuning/types';

export interface Preset {
  id: string;
  name: string;
  tuning: Tuning;
  layout: LayoutSettings;
}

export interface AppState {
  tuning: Tuning;
  layout: LayoutSettings;
  sound: SoundSettings;
  drone: boolean;
  /** Period index shown in the note table. */
  tablePeriod: number;
  /** Hz edits in the table: for all periods (degree class) or for this note only. */
  editScope: 'class' | 'note';
  /** How 12-TET note names are shown: C D E or Do Re Mi. */
  noteNaming: NoteNaming;
  userPresets: Preset[];
  /** Bumped by resetSettings so the UI can remount and drop local form state. Not persisted. */
  resetCount: number;

  setTuning(t: Tuning): void;
  setBaseFreq(f: number): void;
  setOffset(cls: number, cents: number | null): void;
  setAbsOverride(degree: number, hz: number | null): void;
  resetEdits(): void;
  setLayout(patch: Partial<LayoutSettings>): void;
  transposeBy(steps: number): void;
  setSound(patch: Partial<SoundSettings>): void;
  setDrone(on: boolean): void;
  setTablePeriod(p: number): void;
  setEditScope(s: 'class' | 'note'): void;
  setNoteNaming(n: NoteNaming): void;
  savePreset(name: string): void;
  deletePreset(id: string): void;
  loadPreset(p: Preset): void;
  importPresets(list: Preset[]): number;
  /** Restores every setting to its default. Saved presets are kept. */
  resetSettings(): void;
}

export const DEFAULT_SOUND: SoundSettings = {
  engine: 'osc',
  wave: 'triangle',
  cutoff: 20000,
  attack: 0.01,
  decay: 0.3,
  sustain: 0.7,
  release: 0.4,
  harmonics: [1, 0.5, 0.33, 0.25, 0.2, 0.16, 0.14, 0.12, 0, 0, 0, 0, 0, 0, 0, 0],
  sampleSource: 'piano',
  volume: 0.7,
};

/** Transpose that puts degree 0 roughly in the middle of the keyboard (a multiple of the period). */
export function defaultTranspose(t: Tuning, layout: LayoutSettings): number {
  const n = t.stepsCents.length;
  let max = 0;
  for (const k of ALL_KEYS) max = Math.max(max, keyDegree(k, { ...layout, transpose: 0 }));
  return -n * Math.floor(max / 2 / n);
}

function fitLayout(t: Tuning, layout: LayoutSettings): LayoutSettings {
  const steps = isoPresetSteps(t, layout.isoPreset);
  const next = steps ? { ...layout, ...steps } : layout;
  return { ...next, transpose: defaultTranspose(t, next) };
}

const initialTuning = edo(12);
const initialLayout = fitLayout(initialTuning, {
  mode: 'sequential',
  stepRight: 2,
  stepUpRight: 7,
  isoPreset: 'wicki',
  transpose: 0,
});

type Settings = Pick<AppState, 'tuning' | 'layout' | 'sound' | 'drone' | 'tablePeriod' | 'editScope' | 'noteNaming'>;

/** Fresh copies of all default settings. */
function defaultSettings(): Settings {
  return {
    tuning: structuredClone(initialTuning),
    layout: { ...initialLayout },
    sound: structuredClone(DEFAULT_SOUND),
    drone: false,
    tablePeriod: 0,
    editScope: 'class',
    noteNaming: 'letters',
  };
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function isPreset(x: unknown): x is Preset {
  const p = x as Preset;
  return (
    !!p &&
    typeof p.name === 'string' &&
    !!p.tuning &&
    Array.isArray(p.tuning.stepsCents) &&
    p.tuning.stepsCents.length > 0 &&
    p.tuning.stepsCents.every((c) => typeof c === 'number' && Number.isFinite(c)) &&
    typeof p.tuning.periodCents === 'number' &&
    typeof p.tuning.baseFreq === 'number'
  );
}

const STORAGE_KEY = 'xenlab';
const LEGACY_STORAGE_KEY = 'microtonal-sandbox';

/** One-time move of data saved under the app's previous name, so settings and presets survive the rename. */
function migrateLegacyStorage() {
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy === null) return;
    if (localStorage.getItem(STORAGE_KEY) === null) localStorage.setItem(STORAGE_KEY, legacy);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}
migrateLegacyStorage();

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...defaultSettings(),
      userPresets: [],
      resetCount: 0,

      resetSettings: () => set((s) => ({ ...defaultSettings(), resetCount: s.resetCount + 1 })),

      setTuning: (t) => set((s) => ({ tuning: t, layout: fitLayout(t, s.layout), tablePeriod: 0 })),
      setBaseFreq: (f) => {
        if (f > 0 && Number.isFinite(f)) set((s) => ({ tuning: { ...s.tuning, baseFreq: f } }));
      },
      setOffset: (cls, cents) =>
        set((s) => {
          const offsets = { ...s.tuning.offsets };
          if (cents === null || Math.abs(cents) < 1e-9) delete offsets[cls];
          else offsets[cls] = cents;
          return { tuning: { ...s.tuning, offsets } };
        }),
      setAbsOverride: (degree, hz) =>
        set((s) => {
          const absOverrides = { ...s.tuning.absOverrides };
          if (hz === null || !(hz > 0)) delete absOverrides[degree];
          else absOverrides[degree] = hz;
          return { tuning: { ...s.tuning, absOverrides } };
        }),
      resetEdits: () => set((s) => ({ tuning: { ...s.tuning, offsets: {}, absOverrides: {} } })),
      setLayout: (patch) =>
        set((s) => {
          let layout = { ...s.layout, ...patch };
          if (patch.isoPreset && patch.isoPreset !== 'custom') {
            layout = { ...layout, ...isoPresetSteps(s.tuning, patch.isoPreset) };
          }
          if (patch.stepRight !== undefined || patch.stepUpRight !== undefined) {
            layout.isoPreset = patch.isoPreset ?? 'custom';
          }
          if (patch.mode || patch.isoPreset) layout.transpose = defaultTranspose(s.tuning, layout);
          return { layout };
        }),
      transposeBy: (steps) => set((s) => ({ layout: { ...s.layout, transpose: s.layout.transpose + steps } })),
      setSound: (patch) => set((s) => ({ sound: { ...s.sound, ...patch } })),
      setDrone: (on) => set({ drone: on }),
      setTablePeriod: (p) => set({ tablePeriod: p }),
      setEditScope: (editScope) => set({ editScope }),
      setNoteNaming: (noteNaming) => set({ noteNaming }),

      savePreset: (name) => {
        const { tuning, layout, userPresets } = get();
        const existing = userPresets.find((p) => p.name === name);
        const preset: Preset = {
          id: existing?.id ?? uid(),
          name,
          tuning: structuredClone({ ...tuning, name }),
          layout: { ...layout },
        };
        set({
          tuning: { ...tuning, name },
          userPresets: existing
            ? userPresets.map((p) => (p.id === existing.id ? preset : p))
            : [...userPresets, preset],
        });
      },
      deletePreset: (id) => set((s) => ({ userPresets: s.userPresets.filter((p) => p.id !== id) })),
      loadPreset: (p) => set({ tuning: structuredClone(p.tuning), layout: { ...p.layout }, tablePeriod: 0 }),
      importPresets: (list) => {
        const valid = list.filter(isPreset).map((p) => ({
          ...p,
          id: uid(),
          tuning: {
            ...p.tuning,
            offsets: p.tuning.offsets ?? {},
            absOverrides: p.tuning.absOverrides ?? {},
            source: p.tuning.source ?? { kind: 'custom' as const },
          },
          layout: { ...initialLayout, ...p.layout },
        }));
        set((s) => ({ userPresets: [...s.userPresets, ...valid] }));
        return valid.length;
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        tuning: s.tuning,
        layout: s.layout,
        sound: s.sound,
        editScope: s.editScope,
        noteNaming: s.noteNaming,
        userPresets: s.userPresets,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...p,
          sound: { ...current.sound, ...p.sound },
          layout: { ...current.layout, ...p.layout },
        };
      },
    },
  ),
);
