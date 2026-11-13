import { useEffect } from 'react';
import { track } from './analytics';
import { engine, panic, useEngine } from './audio/instance';
import { KeyboardView } from './components/KeyboardView';
import { GeneratorPanel } from './components/GeneratorPanel';
import { LayoutPanel } from './components/LayoutPanel';
import { NoteTable } from './components/NoteTable';
import { PresetsPanel } from './components/PresetsPanel';
import { ConsentBanner } from './components/ConsentBanner';
import { Footer } from './components/Footer';
import { SoundPanel } from './components/SoundPanel';
import { TuningPanel } from './components/TuningPanel';
import { Segmented } from './components/ui';
import { LANGS, useLangStore, useT, type Lang } from './i18n';
import { useKeyboard } from './keyboard/useKeyboard';
import { useStore } from './state/store';
import type { NoteNaming } from './tuning/noteNames';
import { useTheme, type ThemeMode } from './theme/useTheme';

let audioStarted = false;

export function App() {
  useKeyboard();
  const t = useT();
  const { lang, setLang } = useLangStore();
  const { running, sustain } = useEngine();
  const drone = useStore((s) => s.drone);
  const tuningName = useStore((s) => s.tuning.name);
  const noteNaming = useStore((s) => s.noteNaming);
  const setNoteNaming = useStore((s) => s.setNoteNaming);
  const resetCount = useStore((s) => s.resetCount);
  const { mode, setMode } = useTheme();

  // Once per visit: how many visitors actually get to hear something.
  useEffect(() => {
    if (running && !audioStarted) {
      audioStarted = true;
      track('audio_start');
    }
  }, [running]);

  return (
    <div className="app" onPointerDown={() => engine.ensure()}>
      <header className="topbar">
        <div className="brand">
          <h1>{t('app.title')}</h1>
          <span className="subtitle muted">{t('app.subtitle')}</span>
          <bdi className="tuning-chip">{tuningName}</bdi>
        </div>
        <div className="top-actions">
          {!running && (
            <button type="button" className="accent" onClick={() => engine.ensure()}>
              {t('app.enableSound')}
            </button>
          )}
          <span className={`pill ${sustain ? 'on' : ''}`} title={t('app.sustainHint')}>
            {t('app.sustain')}
          </span>
          <button
            type="button"
            className={`toggle ${drone ? 'on' : ''}`}
            aria-pressed={drone}
            onClick={() => {
              engine.ensure();
              useStore.getState().setDrone(!drone);
            }}
            title={t('app.droneHint')}
          >
            {t('app.drone')}
          </button>
          <button type="button" className="ghost" onClick={panic} title={t('app.silenceHint')}>
            {t('app.silence')}
          </button>
          <Segmented<ThemeMode>
            value={mode}
            onChange={setMode}
            ariaLabel={t('app.theme')}
            options={[
              { value: 'auto', label: t('app.themeAuto'), title: t('app.themeAutoHint') },
              { value: 'light', label: '☀', title: t('app.themeLight') },
              { value: 'dark', label: '☾', title: t('app.themeDark') },
            ]}
          />
          <Segmented<NoteNaming>
            value={noteNaming}
            onChange={setNoteNaming}
            ariaLabel={t('app.noteNames')}
            options={[
              { value: 'letters', label: 'C D E', title: t('app.noteNamesLetters') },
              {
                value: 'solfege',
                label: t('note.solfege').split(',').slice(0, 3).join(' '),
                title: t('app.noteNamesSolfege'),
              },
            ]}
          />
          <select
            className="lang-select"
            value={lang}
            onChange={(e) => {
              setLang(e.target.value as Lang);
              track('set_language', { language: e.target.value });
            }}
            aria-label={t('app.language')}
            title={t('app.language')}
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Remount on reset so panels drop their local form state. */}
      <main key={resetCount}>
        <section className="kb-section">
          <KeyboardView />
        </section>
        <div className="grid">
          <div className="col">
            <TuningPanel />
            <PresetsPanel />
          </div>
          <div className="col wide">
            <NoteTable />
            <GeneratorPanel />
          </div>
          <div className="col">
            <LayoutPanel />
            <SoundPanel />
          </div>
        </div>
      </main>
      <Footer />
      <ConsentBanner />
    </div>
  );
}
