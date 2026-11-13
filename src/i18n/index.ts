import { useMemo } from 'react';
import { create } from 'zustand';
import { AppError } from '../errors';
import ar from './locales/ar';
import de from './locales/de';
import en, { type MessageKey, type Messages } from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import he from './locales/he';
import it from './locales/it';
import ja from './locales/ja';
import pt from './locales/pt';
import ru from './locales/ru';
import zh from './locales/zh';

export interface LangInfo {
  code: string;
  /** Native name, shown in the language picker. */
  name: string;
  dir: 'ltr' | 'rtl';
  messages: Messages;
}

/**
 * Order shown in the language picker: alphabetical by native name, the usual convention
 * for language switchers – Latin-script names first, then Cyrillic, Hebrew, Arabic and CJK
 * (the same order Intl.Collator gives).
 */
export const LANGS = [
  { code: 'de', name: 'Deutsch', dir: 'ltr', messages: de },
  { code: 'en', name: 'English', dir: 'ltr', messages: en },
  { code: 'es', name: 'Español', dir: 'ltr', messages: es },
  { code: 'fr', name: 'Français', dir: 'ltr', messages: fr },
  { code: 'it', name: 'Italiano', dir: 'ltr', messages: it },
  { code: 'pt', name: 'Português', dir: 'ltr', messages: pt },
  { code: 'ru', name: 'Русский', dir: 'ltr', messages: ru },
  { code: 'he', name: 'עברית', dir: 'rtl', messages: he },
  { code: 'ar', name: 'العربية', dir: 'rtl', messages: ar },
  { code: 'zh', name: '中文（简体）', dir: 'ltr', messages: zh },
  { code: 'ja', name: '日本語', dir: 'ltr', messages: ja },
] as const satisfies readonly LangInfo[];

export type Lang = (typeof LANGS)[number]['code'];
export type Params = Record<string, string | number>;
export type T = (key: MessageKey, params?: Params) => string;

const STORAGE_KEY = 'lang';
const byCode = new Map<string, LangInfo>(LANGS.map((l) => [l.code, l]));

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && byCode.has(saved)) return saved as Lang;
  } catch {
    /* storage unavailable */
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split('-')[0];
    // Hebrew is sometimes reported with the legacy code "iw".
    const code = base === 'iw' ? 'he' : base;
    if (byCode.has(code)) return code as Lang;
  }
  return 'en';
}

export function makeT(lang: Lang): T {
  const messages = byCode.get(lang)?.messages ?? en;
  return (key, params) => {
    const template = messages[key] ?? en[key] ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
  };
}

function applyToDocument(lang: Lang) {
  const info = byCode.get(lang)!;
  document.documentElement.lang = lang;
  document.documentElement.dir = info.dir;
  const t = makeT(lang);
  document.title = `${t('app.title')} – ${t('app.subtitle')}`;
}

interface LangState {
  lang: Lang;
  setLang(lang: Lang): void;
}

export const useLangStore = create<LangState>((set) => ({
  lang: detect(),
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable */
    }
    applyToDocument(lang);
    set({ lang });
  },
}));

applyToDocument(useLangStore.getState().lang);

/** Translation function for the current language; re-renders the component on language change. */
export function useT(): T {
  const lang = useLangStore((s) => s.lang);
  return useMemo(() => makeT(lang), [lang]);
}

export function useLang(): Lang {
  return useLangStore((s) => s.lang);
}

/** Human-readable, translated error message. */
export function errorText(e: unknown, t: T): string {
  if (e instanceof AppError) return t(e.code, e.params);
  return e instanceof Error ? e.message : String(e);
}
