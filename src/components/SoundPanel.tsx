import { useState } from 'react';
import { track } from '../analytics';
import type { SampleStatus } from '../audio/engine';
import { engine, useEngine } from '../audio/instance';
import type { EngineKind } from '../audio/types';
import { errorText, useT, type T } from '../i18n';
import type { MessageKey } from '../i18n/locales/en';
import { useStore } from '../state/store';
import { C4 } from '../tuning/generators';
import { NumField, Panel, Segmented, Slider } from './ui';

const HARMONIC_PRESETS: [MessageKey, number[]][] = [
  ['sound.hpSine', [1]],
  ['sound.hpOrgan', [1, 0.8, 0, 0.6, 0, 0, 0, 0.4, 0, 0, 0, 0, 0, 0, 0, 0.2]],
  ['sound.hpSaw', Array.from({ length: 16 }, (_, i) => 1 / (i + 1))],
  ['sound.hpSquare', Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? 1 / (i + 1) : 0))],
  ['sound.hpClarinet', [1, 0, 0.75, 0, 0.5, 0, 0.14, 0, 0.5, 0, 0.12, 0, 0.17, 0, 0, 0]],
  ['sound.hpBell', [1, 0, 0, 0.6, 0, 0, 0, 0.3, 0, 0.5, 0, 0, 0.2, 0, 0, 0.1]],
];

const pad16 = (h: number[]) => Array.from({ length: 16 }, (_, i) => h[i] ?? 0);

function statusText(s: SampleStatus, t: T) {
  switch (s.state) {
    case 'idle':
      return t('sound.statusIdle');
    case 'loading':
      return t('sound.statusLoading', { done: s.done, total: s.total });
    case 'ready':
      return t('sound.statusReady', { count: s.count });
    case 'error':
      return t('sound.statusError', { msg: errorText(s.error, t) });
  }
}

export function SoundPanel() {
  const t = useT();
  const sound = useStore((s) => s.sound);
  const { setSound } = useStore.getState();
  const snap = useEngine();
  const [root, setRoot] = useState(C4);

  const sec = (v: number) => (v < 1 ? `${Math.round(v * 1000)} ${t('unit.ms')}` : `${v.toFixed(2)} ${t('unit.s')}`);
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <Panel title={t('sound.title')}>
      <Segmented<EngineKind>
        value={sound.engine}
        onChange={(engineKind) => {
          engine.ensure();
          setSound({ engine: engineKind });
          track('select_sound', { engine: engineKind });
        }}
        ariaLabel={t('sound.source')}
        options={[
          { value: 'osc', label: t('sound.osc') },
          { value: 'additive', label: t('sound.additive') },
          { value: 'sampler', label: t('sound.sampler') },
        ]}
      />

      {sound.engine === 'osc' && (
        <div className="group">
          <Segmented<OscillatorType>
            value={sound.wave}
            onChange={(wave) => setSound({ wave })}
            ariaLabel={t('sound.waveform')}
            options={[
              { value: 'sine', label: t('sound.sine') },
              { value: 'triangle', label: t('sound.triangle') },
              { value: 'square', label: t('sound.square') },
              { value: 'sawtooth', label: t('sound.sawtooth') },
            ]}
          />
          <Slider
            label={t('sound.filter')}
            min={Math.log2(100)}
            max={Math.log2(20000)}
            step={0.01}
            value={Math.log2(sound.cutoff)}
            onChange={(v) => setSound({ cutoff: Math.round(2 ** v) })}
            format={() => (sound.cutoff >= 19000 ? t('sound.off') : `${sound.cutoff} ${t('unit.hz')}`)}
          />
        </div>
      )}

      {sound.engine === 'additive' && (
        <div className="group">
          <div className="harmonics" dir="ltr" role="group" aria-label={t('sound.harmonics')}>
            {sound.harmonics.map((a, i) => (
              <label key={i} className="harm" title={`${t('sound.harmonic', { i: i + 1 })}: ${a.toFixed(2)}`}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={a}
                  onChange={(e) => {
                    const h = [...sound.harmonics];
                    h[i] = +e.target.value;
                    setSound({ harmonics: h });
                  }}
                  aria-label={t('sound.harmonic', { i: i + 1 })}
                />
                <span>{i + 1}</span>
              </label>
            ))}
          </div>
          <div className="quick">
            {HARMONIC_PRESETS.map(([key, h]) => (
              <button key={key} type="button" className="ghost small" onClick={() => setSound({ harmonics: pad16(h) })}>
                {t(key)}
              </button>
            ))}
          </div>
        </div>
      )}

      {sound.engine === 'sampler' && (
        <div className="group">
          <Segmented<'piano' | 'custom'>
            value={sound.sampleSource}
            onChange={(sampleSource) => setSound({ sampleSource })}
            options={[
              { value: 'piano', label: t('sound.piano') },
              { value: 'custom', label: t('sound.customSample') },
            ]}
          />
          {sound.sampleSource === 'piano' ? (
            <div className="sample-info">
              <span>{t('sound.samplesStatus', { status: statusText(snap.piano, t) })}</span>
              {(snap.piano.state === 'idle' || snap.piano.state === 'error') && (
                <button type="button" className="small" onClick={() => void engine.loadPiano()}>
                  {t('sound.load')}
                </button>
              )}
              <p className="hint">{t('sound.pianoCredit')}</p>
            </div>
          ) : (
            <div className="sample-info">
              <label className="field">
                {t('sound.audioFile')}
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void engine.loadCustom(f, root);
                  }}
                />
              </label>
              <label className="field">
                {t('sound.sampleRoot')}
                <NumField
                  value={root}
                  min={1}
                  step={0.01}
                  onCommit={(v) => {
                    setRoot(v);
                    engine.setCustomRoot(v);
                  }}
                />
              </label>
              <span>{t('sound.sampleStatus', { status: statusText(snap.custom, t) })}</span>
            </div>
          )}
        </div>
      )}

      <div className="group">
        <Slider label={t('sound.attack')} min={0.001} max={2} step={0.001} value={sound.attack} onChange={(attack) => setSound({ attack })} format={sec} />
        <Slider label={t('sound.decay')} min={0.01} max={3} step={0.01} value={sound.decay} onChange={(decay) => setSound({ decay })} format={sec} />
        <Slider
          label={t('sound.sustainLevel')}
          min={0}
          max={1}
          step={0.01}
          value={sound.sustain}
          onChange={(sustain) => setSound({ sustain })}
          format={pct}
        />
        <Slider label={t('sound.release')} min={0.01} max={5} step={0.01} value={sound.release} onChange={(release) => setSound({ release })} format={sec} />
        <Slider
          label={t('sound.volume')}
          min={0}
          max={1}
          step={0.01}
          value={sound.volume}
          onChange={(volume) => setSound({ volume })}
          format={pct}
        />
      </div>
    </Panel>
  );
}
