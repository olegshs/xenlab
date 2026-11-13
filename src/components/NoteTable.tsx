import { useMemo } from 'react';
import { engine, useEngine } from '../audio/instance';
import { useT } from '../i18n';
import { useStore } from '../state/store';
import { centsOf, classCents, freqOf, ratioToCents } from '../tuning/frequency';
import { approximateRatio, nearest12 } from '../tuning/ratios';
import { fmtCents, NumField, Panel, Segmented } from './ui';
import { useNoteName } from './useNoteName';

export function NoteTable() {
  const t = useT();
  const tuning = useStore((s) => s.tuning);
  const period = useStore((s) => s.tablePeriod);
  const scope = useStore((s) => s.editScope);
  const { setTablePeriod, setEditScope, setOffset, setAbsOverride, resetEdits } = useStore.getState();
  const { active } = useEngine();
  const noteName = useNoteName();
  const sounding = useMemo(() => new Set(active.values()), [active]);
  const n = tuning.stepsCents.length;
  const hasEdits = Object.keys(tuning.offsets).length > 0 || Object.keys(tuning.absOverrides).length > 0;

  const rows = Array.from({ length: n + 1 }, (_, i) => i);

  const commitCents = (i: number, cents: number) => setOffset(i, cents - tuning.stepsCents[i]);
  const commitHz = (i: number, hz: number) => {
    const degree = period * n + i;
    if (scope === 'note') {
      setAbsOverride(degree, hz);
    } else {
      setAbsOverride(degree, null);
      const cents = ratioToCents(hz / tuning.baseFreq) - period * tuning.periodCents;
      setOffset(i, cents - tuning.stepsCents[i]);
    }
  };

  return (
    <Panel
      title={t('notes.title')}
      actions={
        <button type="button" className="ghost small" disabled={!hasEdits} onClick={resetEdits}>
          {t('notes.resetAll')}
        </button>
      }
    >
      <div className="toolbar">
        <div className="stepper" aria-label={t('notes.period')}>
          <button type="button" onClick={() => setTablePeriod(period - 1)} aria-label={t('notes.periodDown')}>
            −
          </button>
          <span>
            {t('notes.period')} <b>{period}</b>
          </span>
          <button type="button" onClick={() => setTablePeriod(period + 1)} aria-label={t('notes.periodUp')}>
            +
          </button>
        </div>
        <label className="inline">
          {t('notes.editHz')}
          <Segmented
            value={scope}
            onChange={setEditScope}
            options={[
              { value: 'class', label: t('notes.scopeClass'), title: t('notes.scopeClassHint') },
              { value: 'note', label: t('notes.scopeNote'), title: t('notes.scopeNoteHint') },
            ]}
          />
        </label>
      </div>
      <div className="table-wrap">
        <table className="notes">
          <thead>
            <tr>
              <th />
              <th>#</th>
              <th title={t('notes.colCentsHint')}>{t('notes.colCents')}</th>
              <th title={t('notes.colStepHint')}>{t('notes.colStep')}</th>
              <th>{t('notes.colHz')}</th>
              <th title={t('notes.colRatioHint')}>{t('notes.colRatio')}</th>
              <th title={t('notes.col12Hint')}>{t('notes.col12')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const isPeriodRow = i === n;
              const cls = isPeriodRow ? 0 : i;
              const degree = period * n + i;
              const cents = isPeriodRow ? tuning.periodCents + classCents(tuning, 0) : classCents(tuning, i);
              const prev = i === 0 ? null : centsOf(tuning, period * n + i - 1) - period * tuning.periodCents;
              const freq = freqOf(tuning, degree);
              const ratio = approximateRatio(cents - classCents(tuning, 0));
              const near = nearest12(freq);
              const offset = tuning.offsets[cls];
              const override = tuning.absOverrides[degree];
              const id = `row:${degree}`;
              return (
                <tr
                  key={i}
                  className={[isPeriodRow && 'period-row', sounding.has(degree) && 'sounding'].filter(Boolean).join(' ')}
                >
                  <td>
                    <button
                      type="button"
                      className="play"
                      aria-label={t('notes.play', { i })}
                      onPointerDown={() => engine.noteOn(id, degree, freq)}
                      onPointerUp={() => engine.noteOff(id)}
                      onPointerLeave={() => engine.noteOff(id)}
                    >
                      ▶
                    </button>
                  </td>
                  <td className="num">{isPeriodRow ? `${n} (0′)` : i}</td>
                  <td>
                    {isPeriodRow ? (
                      <span className="num">{cents.toFixed(3)}</span>
                    ) : (
                      <NumField
                        className={offset !== undefined ? 'edited' : ''}
                        value={cents}
                        step={0.1}
                        onCommit={(v) => commitCents(i, v)}
                        title={offset !== undefined ? t('notes.editedBy', { c: fmtCents(offset) }) : undefined}
                        ariaLabel={t('notes.centsOf', { i })}
                      />
                    )}
                  </td>
                  <td className="num muted">{prev === null ? '' : (cents - prev).toFixed(2)}</td>
                  <td>
                    {isPeriodRow ? (
                      <span className="num">{freq.toFixed(3)}</span>
                    ) : (
                      <NumField
                        className={override !== undefined ? 'edited override' : ''}
                        value={freq}
                        step={0.01}
                        min={0.01}
                        onCommit={(v) => commitHz(i, v)}
                        title={override !== undefined ? t('notes.overridden') : undefined}
                        ariaLabel={t('notes.hzOf', { i })}
                      />
                    )}
                  </td>
                  <td className="num">
                    {ratio && (
                      <bdi>
                        {ratio.p}/{ratio.q} <span className="muted">{fmtCents(ratio.error)}</span>
                      </bdi>
                    )}
                  </td>
                  <td className="num">
                    <bdi>
                      {noteName(near)} <span className="muted">{fmtCents(near.deviation)}</span>
                    </bdi>
                  </td>
                  <td>
                    {!isPeriodRow && (offset !== undefined || override !== undefined) && (
                      <button
                        type="button"
                        className="ghost small"
                        title={t('notes.resetOne')}
                        aria-label={t('notes.resetOne')}
                        onClick={() => {
                          setOffset(i, null);
                          setAbsOverride(degree, null);
                        }}
                      >
                        ↺
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
