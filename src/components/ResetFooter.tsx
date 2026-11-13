import { useState } from 'react';
import { panic } from '../audio/instance';
import { useT } from '../i18n';
import { useStore } from '../state/store';
import { useThemeStore } from '../theme/useTheme';

/** Page footer with a "reset all settings" button that asks for confirmation inline. */
export function ResetFooter() {
  const t = useT();
  const [state, setState] = useState<'idle' | 'confirm' | 'done'>('idle');

  const reset = () => {
    panic();
    useStore.getState().resetSettings();
    useThemeStore.getState().setMode('auto');
    setState('done');
  };

  return (
    <footer className="footer">
      {state === 'confirm' ? (
        <div className="reset-confirm" role="alertdialog" aria-labelledby="reset-confirm-text">
          <p id="reset-confirm-text">{t('reset.confirm')}</p>
          <div className="quick">
            <button type="button" className="danger-solid" onClick={reset}>
              {t('reset.yes')}
            </button>
            <button type="button" className="ghost" onClick={() => setState('idle')} autoFocus>
              {t('reset.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <button type="button" className="ghost" onClick={() => setState('confirm')}>
            {t('reset.button')}
          </button>
          {state === 'done' && (
            <span className="ok" role="status">
              {t('reset.done')}
            </span>
          )}
        </>
      )}
    </footer>
  );
}
