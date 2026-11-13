import { useT } from '../i18n';
import type { IsoPreset, LayoutMode } from '../keyboard/mapping';
import { useStore } from '../state/store';
import { NumField, Panel, Segmented } from './ui';

export function LayoutPanel() {
  const t = useT();
  const layout = useStore((s) => s.layout);
  const n = useStore((s) => s.tuning.stepsCents.length);
  const { setLayout, transposeBy } = useStore.getState();

  return (
    <Panel title={t('layout.title')}>
      <Segmented<LayoutMode>
        value={layout.mode}
        onChange={(mode) => setLayout({ mode })}
        ariaLabel={t('layout.mode')}
        options={[
          { value: 'sequential', label: t('layout.sequential'), title: t('layout.sequentialHint') },
          { value: 'isomorphic', label: t('layout.isomorphic'), title: t('layout.isomorphicHint') },
        ]}
      />

      {layout.mode === 'isomorphic' && (
        <div className="iso">
          <label className="field">
            {t('layout.preset')}
            <select value={layout.isoPreset} onChange={(e) => setLayout({ isoPreset: e.target.value as IsoPreset })}>
              <option value="wicki">{t('layout.wicki')}</option>
              <option value="chromatic">{t('layout.chromatic')}</option>
              <option value="custom">{t('layout.custom')}</option>
            </select>
          </label>
          {/* Arrows describe physical directions on the keyboard, so this row stays left-to-right. */}
          <div className="row" dir="ltr">
            <label className="field">
              <bdi>{t('layout.stepRight')}</bdi>
              <NumField value={layout.stepRight} step={1} digits={0} onCommit={(v) => setLayout({ stepRight: Math.round(v) })} />
            </label>
            <label className="field">
              <bdi>{t('layout.stepUpRight')}</bdi>
              <NumField
                value={layout.stepUpRight}
                step={1}
                digits={0}
                onCommit={(v) => setLayout({ stepUpRight: Math.round(v) })}
              />
            </label>
            <div className="field">
              <bdi>{t('layout.stepUpLeft')}</bdi>
              <span className="readout">{layout.stepUpRight - layout.stepRight}</span>
            </div>
          </div>
        </div>
      )}

      <div className="transpose">
        <span>{t('layout.shift')}</span>
        <div className="stepper" dir="ltr">
          <button type="button" onClick={() => transposeBy(-n)} title={t('layout.periodDown')}>
            ⇊
          </button>
          <button type="button" onClick={() => transposeBy(-1)} title={t('layout.stepDown')}>
            −
          </button>
          <span className="num">
            <b>{layout.transpose}</b>
          </span>
          <button type="button" onClick={() => transposeBy(1)} title={t('layout.stepUp')}>
            +
          </button>
          <button type="button" onClick={() => transposeBy(n)} title={t('layout.periodUp')}>
            ⇈
          </button>
        </div>
      </div>

      <ul className="hotkeys">
        <li>
          <kbd>←</kbd> <kbd>→</kbd> {t('layout.hkDegree')} · <kbd>↑</kbd> <kbd>↓</kbd> {t('layout.hkPeriod')}
        </li>
        <li>
          <kbd>{t('layout.hkSpace')}</kbd> {t('layout.hkSustain')} · <kbd>Esc</kbd> {t('layout.hkSilence')}
        </li>
        <li className="muted">{t('layout.anyLayout')}</li>
      </ul>
    </Panel>
  );
}
