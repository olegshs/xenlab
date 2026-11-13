import { create } from 'zustand';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const KEY = 'theme-mode';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'auto') return v;
  } catch {
    /* storage unavailable */
  }
  return 'auto';
}

const resolve = (mode: ThemeMode): Theme => (mode === 'auto' ? (media().matches ? 'dark' : 'light') : mode);

interface ThemeState {
  mode: ThemeMode;
  /** The theme actually applied (auto resolved against the system setting). */
  theme: Theme;
  setMode(mode: ThemeMode): void;
}

/** Shared theme state, so any component (e.g. "reset to defaults") can change it. */
export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: readMode(),
  theme: resolve(readMode()),
  setMode: (mode) => {
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* storage unavailable */
    }
    set({ mode, theme: resolve(mode) });
    apply(get().theme);
  },
}));

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

apply(useThemeStore.getState().theme);

// In auto mode, follow changes of the system setting.
media().addEventListener('change', () => {
  const { mode } = useThemeStore.getState();
  if (mode !== 'auto') return;
  const theme = resolve(mode);
  useThemeStore.setState({ theme });
  apply(theme);
});

export function useTheme() {
  return useThemeStore();
}
