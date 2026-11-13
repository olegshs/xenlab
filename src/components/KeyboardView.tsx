import { useMemo, type CSSProperties } from 'react';
import { engine, useEngine } from '../audio/instance';
import { useLang, useT } from '../i18n';
import { KEY_ROWS, NATIVE_LABELS, ROW_OFFSET } from '../keyboard/layouts';
import { buildKeyMap } from '../keyboard/mapping';
import { keyVoiceId } from '../keyboard/useKeyboard';
import { useStore } from '../state/store';
import { degreeClass, freqOf, periodIndex } from '../tuning/frequency';
import { nearest12 } from '../tuning/ratios';
import { useNoteName } from './useNoteName';

const mouseId = (code: string) => `mouse:${code}`;

export function KeyboardView() {
  const t = useT();
  const lang = useLang();
  const tuning = useStore((s) => s.tuning);
  const layout = useStore((s) => s.layout);
  const { active } = useEngine();
  const map = useMemo(() => buildKeyMap(layout), [layout]);
  const n = tuning.stepsCents.length;
  const soundingDegrees = useMemo(() => new Set(active.values()), [active]);
  const native = NATIVE_LABELS[lang];
  const noteName = useNoteName();

  const play = (code: string, degree: number) => engine.noteOn(mouseId(code), degree, freqOf(tuning, degree));
  const stop = (code: string) => engine.noteOff(mouseId(code));

  return (
    // The keyboard mirrors physical key positions, so it stays left-to-right in RTL languages.
    <div className="keyboard" dir="ltr" role="group" aria-label={t('kb.label')}>
      {KEY_ROWS.map((row) => (
        <div className="kb-row" key={row[0].row} style={{ '--off': ROW_OFFSET[row[0].row] } as CSSProperties}>
          {row.map((k) => {
            const degree = map.get(k.code)!;
            const cls = degreeClass(n, degree);
            const period = periodIndex(n, degree);
            const freq = freqOf(tuning, degree);
            const alt = native?.get(k.code);
            const pressed = active.has(keyVoiceId(k.code)) || active.has(mouseId(k.code));
            const sounding = !pressed && soundingDegrees.has(degree);
            const edited = tuning.offsets[cls] !== undefined || tuning.absOverrides[degree] !== undefined;
            return (
              <button
                key={k.code}
                type="button"
                tabIndex={-1}
                className={['key', cls === 0 && 'tonic', pressed && 'pressed', sounding && 'sounding', edited && 'edited']
                  .filter(Boolean)
                  .join(' ')}
                style={{ '--h': (360 * cls) / n } as CSSProperties}
                title={t('kb.keyTitle', {
                  key: alt ? `${k.label} / ${alt}` : k.label,
                  cls,
                  period,
                  freq: freq.toFixed(2),
                })}
                onPointerDown={(e) => {
                  e.preventDefault();
                  play(k.code, degree);
                }}
                onPointerEnter={(e) => e.buttons & 1 && play(k.code, degree)}
                onPointerUp={() => stop(k.code)}
                onPointerLeave={() => stop(k.code)}
              >
                <span className="key-cap">
                  {k.label}
                  {alt && alt !== k.label && <span className="key-alt">{alt}</span>}
                </span>
                <span className="key-deg">
                  {cls}
                  <sub>{period}</sub>
                </span>
                <span className="key-note">{noteName(nearest12(freq))}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
