import { useMemo } from 'react';
import { engine } from '../audio/instance';
import { useT, type T } from '../i18n';
import { demoScore, pieceScore, pumpScore, signed, type Score, type SectionLabel, type Texture } from '../music/generator';
import { play, playNext, setLoop, setTempo, stop, useSequencer } from '../music/sequencer';
import { availableChords, chordDegrees, intervalCents, pumpDrift, SYNTONIC_COMMA, type ChordFit } from '../music/theory';
import { randomSeed, useStore, type GeneratorMode } from '../state/store';
import { freqOf } from '../tuning/frequency';
import type { Tuning } from '../tuning/types';
import { NumField, Panel, Segmented, Slider } from './ui';

export function sectionText(label: SectionLabel, t: T): string {
  const params: Record<string, string | number> = { ...label.params };
  for (const [name, key] of Object.entries(label.keyParams ?? {})) params[name] = t(key);
  return t(label.key, params);
}

function buildScore(tuning: Tuning, gen: ReturnType<typeof useStore.getState>['generator']): Score | null {
  switch (gen.mode) {
    case 'demo':
      return demoScore(tuning);
    case 'piece':
      return pieceScore(tuning, { seed: gen.seed, bars: gen.bars, texture: gen.texture });
    case 'pump':
      return pumpScore(tuning);
  }
}

/** Plays a chord from the table for a moment. */
function previewChord(tuning: Tuning, fit: ChordFit) {
  const ctx = engine.ensure();
  const now = ctx.currentTime;
  chordDegrees(fit).forEach((d, i) => {
    const id = `preview:${d}:${i}`;
    engine.noteOn(id, d, freqOf(tuning, d), { gain: 0.7 });
    engine.noteOff(id, { when: now + 1.5, force: true });
  });
}

export function GeneratorPanel() {
  const t = useT();
  const tuning = useStore((s) => s.tuning);
  const gen = useStore((s) => s.generator);
  const setGenerator = useStore((s) => s.setGenerator);
  const { playing, section, queued } = useSequencer();
  const chords = useMemo(() => availableChords(tuning, 0), [tuning]);
  const drift = useMemo(() => pumpDrift(tuning), [tuning]);
  const canPlay = gen.mode !== 'pump' || drift !== null;

  /** Starts playback, or with `next` switches to the new score at the next bar line. */
  const start = (settings = gen, next = false) => {
    engine.ensure();
    const score = buildScore(useStore.getState().tuning, settings);
    if (score) (next ? playNext : play)(score, { tempo: settings.tempo, loop: settings.loop });
  };

  /** Changes settings that affect the score; while playing, the new score takes over at the next bar. */
  const update = (patch: Partial<typeof gen>) => {
    setGenerator(patch);
    if (playing) start({ ...gen, ...patch }, true);
  };

  return (
    <Panel
      title={t('gen.title')}
      actions={
        <button
          type="button"
          className={playing ? 'toggle on' : 'accent'}
          disabled={!canPlay}
          onClick={() => (playing ? stop() : start())}
        >
          {playing ? `■ ${t('gen.stop')}` : `▶ ${t('gen.play')}`}
        </button>
      }
    >
      <Segmented<GeneratorMode>
        value={gen.mode}
        onChange={(mode) => {
          stop();
          setGenerator({ mode });
        }}
        ariaLabel={t('gen.mode')}
        options={[
          { value: 'demo', label: t('gen.demo'), title: t('gen.demoHint') },
          { value: 'piece', label: t('gen.piece'), title: t('gen.pieceHint') },
          { value: 'pump', label: t('gen.pump'), title: t('gen.pumpHint') },
        ]}
      />

      {gen.mode === 'piece' && (
        <div className="gen-options">
          <Segmented<Texture>
            value={gen.texture}
            onChange={(texture) => update({ texture })}
            ariaLabel={t('gen.texture')}
            options={[
              { value: 'chorale', label: t('gen.chorale') },
              { value: 'arpeggio', label: t('gen.arpeggio') },
            ]}
          />
          <label className="inline">
            {t('gen.bars')}
            <Segmented<string>
              value={String(gen.bars)}
              onChange={(v) => update({ bars: Number(v) })}
              options={['4', '8', '16'].map((v) => ({ value: v, label: v }))}
            />
          </label>
          <label className="inline seed">
            {t('gen.seed')}
            <NumField value={gen.seed} min={1} step={1} digits={0} onCommit={(v) => update({ seed: Math.round(v) })} />
          </label>
          <button type="button" className="ghost small" title={t('gen.newSeedHint')} onClick={() => update({ seed: randomSeed() })}>
            🎲 {t('gen.newSeed')}
          </button>
        </div>
      )}

      {gen.mode === 'pump' && (
        <div className="pump-info">
          {drift === null ? (
            <p className="hint">{t('gen.pumpUnavailable')}</p>
          ) : (
            <>
              <p>
                {drift === 0
                  ? t('gen.pumpTempered')
                  : t('gen.pumpDrift', {
                      steps: signed(drift, 0),
                      cents: signed(intervalCents(tuning, 0, drift)),
                    })}
              </p>
              <p className="hint">{t('gen.pumpJi', { comma: SYNTONIC_COMMA.toFixed(1) })}</p>
            </>
          )}
        </div>
      )}

      <Slider
        label={t('gen.tempo')}
        min={40}
        max={200}
        step={1}
        value={gen.tempo}
        onChange={(tempo) => {
          setGenerator({ tempo });
          setTempo(tempo);
        }}
        format={(v) => `${v} BPM`}
      />
      <label className="check">
        <input
          type="checkbox"
          checked={gen.loop}
          onChange={(e) => {
            setGenerator({ loop: e.target.checked });
            setLoop(e.target.checked);
          }}
        />
        {t('gen.loop')}
      </label>

      <p className="now-playing" aria-live="polite">
        {section ? t('gen.nowPlaying', { section: sectionText(section, t) }) : t('gen.idle')}
        {queued && <span className="queued"> · {t('gen.queued')}</span>}
      </p>

      <h3 className="sub-title">{t('gen.chords')}</h3>
      {chords.length === 0 ? (
        <p className="muted">{t('gen.noChords')}</p>
      ) : (
        <div className="table-wrap">
          <table className="notes chords">
            <thead>
              <tr>
                <th />
                <th>{t('gen.colChord')}</th>
                <th>{t('gen.colRatio')}</th>
                <th>{t('gen.colSteps')}</th>
                <th>{t('gen.colError')}</th>
              </tr>
            </thead>
            <tbody>
              {chords.map((fit) => (
                <tr key={fit.type.id}>
                  <td>
                    <button
                      type="button"
                      className="play"
                      aria-label={t('gen.playChord', { name: t(fit.type.key) })}
                      onClick={() => previewChord(tuning, fit)}
                    >
                      ▶
                    </button>
                  </td>
                  <td>
                    {t(fit.type.key)}
                    {fit.approximate && <span className="muted"> ({t('gen.approx')})</span>}
                  </td>
                  <td className="num">{fit.type.label}</td>
                  <td className="num">
                    <bdi>{[0, ...fit.steps].join('–')}</bdi>
                  </td>
                  <td className="num">
                    <bdi>{fit.errors.map((e) => signed(e)).join(' / ')}</bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
