import { useRef, useState } from 'react';
import { useT, type Params } from '../i18n';
import type { MessageKey } from '../i18n/locales/en';
import { useStore, type Preset } from '../state/store';
import { classCents } from '../tuning/frequency';
import { toScala } from '../tuning/scala';
import { download, Panel } from './ui';

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'tuning';

/** Stored as a key so the message follows language changes. */
type Msg = { key: MessageKey; params?: Params; error?: boolean };

export function PresetsPanel() {
  const t = useT();
  const tuning = useStore((s) => s.tuning);
  const presets = useStore((s) => s.userPresets);
  const { savePreset, deletePreset, loadPreset, importPresets } = useStore.getState();
  const [name, setName] = useState(tuning.name);
  const [msg, setMsg] = useState<Msg | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportScl = () => {
    // Degree edits are baked into the export; degree 0 is normalised to 0 cents.
    const n = tuning.stepsCents.length;
    const zero = classCents(tuning, 0);
    const steps = Array.from({ length: n }, (_, i) => classCents(tuning, i) - zero);
    download(`${safeName(tuning.name)}.scl`, toScala(tuning.name, steps, tuning.periodCents), 'text/plain');
  };

  const onImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as unknown;
      const list = (Array.isArray(data) ? data : [data]) as Preset[];
      const count = importPresets(list);
      setMsg(count ? { key: 'presets.imported', params: { n: count } } : { key: 'presets.noneValid', error: true });
    } catch (e) {
      setMsg({ key: 'presets.badJson', params: { msg: e instanceof Error ? e.message : String(e) }, error: true });
    }
  };

  return (
    <Panel title={t('presets.title')}>
      <form
        className="gen"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          savePreset(n);
          setMsg({ key: 'presets.saved', params: { name: n } });
        }}
      >
        <label className="field grow">
          {t('presets.name')}
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" disabled={!name.trim()}>
          {t('presets.save')}
        </button>
      </form>
      <p className="hint">{t('presets.saveHint')}</p>

      {presets.length > 0 ? (
        <ul className="presets">
          {presets.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="ghost preset-name"
                onClick={() => {
                  loadPreset(p);
                  setName(p.name);
                }}
                title={t('presets.load')}
              >
                <bdi>{p.name}</bdi>
                <span className="muted"> · {t('common.degrees', { n: p.tuning.stepsCents.length })}</span>
              </button>
              <button
                type="button"
                className="ghost small"
                title={t('presets.exportJson')}
                aria-label={t('presets.exportJson')}
                onClick={() => download(`${safeName(p.name)}.json`, JSON.stringify(p, null, 2))}
              >
                ⤓
              </button>
              <button
                type="button"
                className="ghost small danger"
                title={t('presets.delete')}
                aria-label={t('presets.delete')}
                onClick={() => deletePreset(p.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{t('presets.none')}</p>
      )}

      <div className="quick">
        <button
          type="button"
          className="ghost small"
          disabled={!presets.length}
          onClick={() => download('xenlab-presets.json', JSON.stringify(presets, null, 2))}
        >
          {t('presets.exportAll')}
        </button>
        <button type="button" className="ghost small" onClick={() => fileRef.current?.click()}>
          {t('presets.import')}
        </button>
        <button type="button" className="ghost small" onClick={exportScl}>
          {t('presets.toScl')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImport(f);
            e.target.value = '';
          }}
        />
      </div>
      {msg && <p className={msg.error ? 'error' : 'ok'}>{t(msg.key, msg.params)}</p>}
    </Panel>
  );
}
