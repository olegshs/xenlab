import { describe, expect, it } from 'vitest';
import ar from './locales/ar';
import de from './locales/de';
import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import he from './locales/he';
import italian from './locales/it';
import ja from './locales/ja';
import pt from './locales/pt';
import ru from './locales/ru';
import zh from './locales/zh';

const LOCALES = { ar, de, es, fr, he, it: italian, ja, pt, ru, zh };
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('locales', () => {
  for (const [code, messages] of Object.entries({ en, ...LOCALES })) {
    it(`${code}: seven solfège syllables`, () => {
      const syllables = messages['note.solfege'].split(',');
      expect(syllables).toHaveLength(7);
      expect(syllables.every((s) => s.trim() === s && s.length > 0)).toBe(true);
    });
  }

  for (const [code, messages] of Object.entries(LOCALES)) {
    it(`${code}: same keys and placeholders as en, no empty strings`, () => {
      expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
      for (const [key, value] of Object.entries(en)) {
        const translated = messages[key as keyof typeof en];
        expect(translated.trim(), `${code}:${key}`).not.toBe('');
        expect(placeholders(translated), `${code}:${key}`).toEqual(placeholders(value));
      }
    });
  }
});
