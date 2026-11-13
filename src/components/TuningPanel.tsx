import { useMemo, useState } from 'react';
import { track } from '../analytics';
import { errorText, useT } from '../i18n';
import { useStore } from '../state/store';
import { BUILTIN_TUNINGS, matchBuiltin } from '../tuning/builtins';
import { C4, edo, edx, fromPitchList, fromScala } from '../tuning/generators';
import { parseScala } from '../tuning/scala';
import type { Tuning } from '../tuning/types';
import { NumField, Panel, Segmented } from './ui';

type Gen = 'edo' | 'edx' | 'list' | 'scala';

export function TuningPanel() {
  const t = useT();
  const tuning = useStore((s) => s.tuning);
  const { setTuning, setBaseFreq } = useStore.getState();
  const [gen, setGen] = useState<Gen>(tuning.source.kind === 'edx' ? 'edx' : 'edo');
  const [n, setN] = useState(tuning.source.kind === 'edo' || tuning.source.kind === 'edx' ? tuning.source.n : 19);
  const [interval, setIntervalText] = useState(tuning.source.kind === 'edx' ? tuning.source.interval : '3/1');
  const [list, setList] = useState('9/8\n5/4\n4/3\n3/2\n5/3\n15/8\n2/1');
  const [scl, setScl] = useState('');
  const [error, setError] = useState<unknown>(null);
  // The picker shows a built-in tuning for as long as the current tuning still matches it exactly;
  // any edit (degrees, base frequency, per-note changes) switches it back to the placeholder.
  const builtinId = useMemo(() => matchBuiltin(tuning), [tuning]);

  const apply = (method: Gen, make: () => Tuning) => {
    try {
      const next = make();
      setTuning({ ...next, baseFreq: tuning.baseFreq });
      setError(null);
      track('create_tuning', { method, size: next.stepsCents.length });
    } catch (e) {
      setError(e);
    }
  };

  const applyScala = (text: string, name: string) =>
    apply('scala', () => {
      const s = parseScala(text);
      return fromScala(s, s.description || name);
    });

  const nValid = Number.isInteger(n) && n >= 1 && n <= 1000;

  return (
    <Panel title={t('tuning.title')}>
      <div className="current">
        <b>{tuning.name}</b>
        <span className="muted">
          {t('tuning.summary', { n: tuning.stepsCents.length, p: tuning.periodCents.toFixed(3) })}
        </span>
        {tuning.description && tuning.description !== tuning.name && (
          <span className="muted small-text">{tuning.description}</span>
        )}
      </div>

      <label className="field">
        {t('tuning.builtin')}
        <select
          value={builtinId ?? ''}
          onChange={(e) => {
            const b = BUILTIN_TUNINGS.find((x) => x.id === e.target.value);
            if (!b) return;
            const next = b.make();
            setTuning({ ...next, name: b.labelKey ? t(b.labelKey) : (b.label ?? next.name) });
            setError(null);
            track('select_tuning', { tuning: b.id });
            if (next.source.kind === 'edo' || next.source.kind === 'edx') setN(next.source.n);
            if (next.source.kind === 'edx') setIntervalText(next.source.interval);
          }}
        >
          <option value="" disabled>
            {t('tuning.choose')}
          </option>
          {BUILTIN_TUNINGS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.labelKey ? t(b.labelKey) : b.label}
            </option>
          ))}
        </select>
      </label>

      <Segmented
        value={gen}
        onChange={(g) => {
          setGen(g);
          setError(null);
        }}
        ariaLabel={t('tuning.method')}
        options={[
          { value: 'edo', label: 'N-EDO', title: t('tuning.edoHint') },
          { value: 'edx', label: 'EDx', title: t('tuning.edxHint') },
          { value: 'list', label: t('tuning.list'), title: t('tuning.listHint') },
          { value: 'scala', label: 'Scala', title: t('tuning.scalaHint') },
        ]}
      />

      {gen === 'edo' && (
        <form
          className="gen"
          onSubmit={(e) => {
            e.preventDefault();
            apply('edo', () => edo(n));
          }}
        >
          <label className="field">
            {t('tuning.stepsPerOctave')}
            <input type="number" min={1} max={1000} value={n} onChange={(e) => setN(parseInt(e.target.value, 10))} />
          </label>
          <button type="submit" disabled={!nValid}>
            {t('tuning.apply')}
          </button>
        </form>
      )}

      {gen === 'edx' && (
        <form
          className="gen"
          onSubmit={(e) => {
            e.preventDefault();
            apply('edx', () => edx(n, interval.trim()));
          }}
        >
          <label className="field">
            {t('tuning.steps')}
            <input type="number" min={1} max={1000} value={n} onChange={(e) => setN(parseInt(e.target.value, 10))} />
          </label>
          <label className="field">
            {t('tuning.interval')}
            <input
              type="text"
              dir="ltr"
              value={interval}
              onChange={(e) => setIntervalText(e.target.value)}
              placeholder={t('tuning.intervalPlaceholder')}
              title={t('tuning.intervalHint')}
            />
          </label>
          <button type="submit" disabled={!nValid}>
            {t('tuning.apply')}
          </button>
        </form>
      )}

      {gen === 'list' && (
        <form
          className="gen column"
          onSubmit={(e) => {
            e.preventDefault();
            apply('list', () => fromPitchList(t('tuning.customName'), list.split('\n')));
          }}
        >
          <label className="field">
            {t('tuning.listLabel')}
            <textarea rows={7} dir="ltr" value={list} onChange={(e) => setList(e.target.value)} spellCheck={false} />
          </label>
          <p className="hint">{t('tuning.listHelp')}</p>
          <button type="submit">{t('tuning.apply')}</button>
        </form>
      )}

      {gen === 'scala' && (
        <div className="gen column">
          <label className="field">
            {t('tuning.sclFile')}
            <input
              type="file"
              accept=".scl,text/plain"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const text = await f.text();
                setScl(text);
                applyScala(text, f.name.replace(/\.scl$/i, ''));
                e.target.value = '';
              }}
            />
          </label>
          <label className="field">
            {t('tuning.sclPaste')}
            <textarea rows={6} dir="ltr" value={scl} onChange={(e) => setScl(e.target.value)} spellCheck={false} />
          </label>
          <button type="button" disabled={!scl.trim()} onClick={() => applyScala(scl, 'Scala')}>
            {t('tuning.apply')}
          </button>
          <p className="hint">
            <a href="https://www.huygens-fokker.org/scala/downloads.html" target="_blank" rel="noreferrer">
              {t('tuning.sclArchive')}
            </a>
          </p>
        </div>
      )}

      {error != null && <p className="error">{errorText(error, t)}</p>}

      <div className="base">
        <label className="field">
          {t('tuning.baseFreq')}
          <NumField value={tuning.baseFreq} min={1} max={20000} step={0.01} digits={3} onCommit={setBaseFreq} />
        </label>
        <div className="quick">
          <button type="button" className="ghost small" onClick={() => setBaseFreq(C4)} title={t('tuning.c4Hint')}>
            C4
          </button>
          <button type="button" className="ghost small" onClick={() => setBaseFreq(220)}>
            A3
          </button>
          <button type="button" className="ghost small" onClick={() => setBaseFreq(440)}>
            A4
          </button>
          <button type="button" className="ghost small" onClick={() => setBaseFreq(256)} title={t('tuning.sci256Hint')}>
            256
          </button>
        </div>
      </div>
    </Panel>
  );
}
