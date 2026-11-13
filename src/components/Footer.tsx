import { useState } from 'react';
import { panic } from '../audio/instance';
import { useT } from '../i18n';
import { useStore } from '../state/store';
import { useThemeStore } from '../theme/useTheme';

/** Source code link from the build settings (.env); hidden when not configured. */
export const SOURCE_URL = import.meta.env.VITE_SOURCE_URL?.trim() || null;
const LICENSE_URL = 'https://www.gnu.org/licenses/agpl-3.0.html';

/** Page footer: source code and license links, and "reset all settings" with an inline confirmation. */
export function Footer() {
  const t = useT();
  return (
    <footer className="footer">
      <nav className="footer-links" aria-label={t('app.aboutLinks')}>
        <span>XenLab</span>
        {SOURCE_URL && (
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">
            <CodeIcon />
            {t('app.sourceCode')}
          </a>
        )}
        <a href={LICENSE_URL} target="_blank" rel="noreferrer license" title="GNU Affero General Public License v3.0 or later">
          {t('app.license')}: AGPL-3.0
        </a>
      </nav>
      <ResetControl />
    </footer>
  );
}

function ResetControl() {
  const t = useT();
  const [state, setState] = useState<'idle' | 'confirm' | 'done'>('idle');

  const reset = () => {
    panic();
    useStore.getState().resetSettings();
    useThemeStore.getState().setMode('auto');
    setState('done');
  };

  if (state === 'confirm') {
    return (
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
    );
  }
  return (
    <div className="reset">
      {state === 'done' && (
        <span className="ok" role="status">
          {t('reset.done')}
        </span>
      )}
      <button type="button" className="ghost" onClick={() => setState('confirm')}>
        {t('reset.button')}
      </button>
    </div>
  );
}

function CodeIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
