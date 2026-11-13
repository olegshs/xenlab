import { ANALYTICS_ENABLED, useConsent } from '../analytics';
import { useLang, useT } from '../i18n';

/**
 * Asks whether Google Analytics may be used. Shown until the visitor chooses, and again from the footer.
 * Both answers are equally easy to give, as consent rules require.
 */
export function ConsentBanner() {
  const t = useT();
  const lang = useLang();
  const { asking, consent, setConsent } = useConsent();
  if (!ANALYTICS_ENABLED || !asking) return null;
  return (
    <aside className="consent" aria-labelledby="consent-title">
      <h2 id="consent-title">{t('consent.title')}</h2>
      <p>
        {t('consent.text')}{' '}
        <a href={`https://policies.google.com/technologies/partner-sites?hl=${lang}`} target="_blank" rel="noreferrer">
          {t('consent.more')}
        </a>
      </p>
      <div className="quick">
        <button type="button" className="accent" aria-pressed={consent === 'granted'} onClick={() => setConsent('granted')}>
          {t('consent.allow')}
        </button>
        <button type="button" aria-pressed={consent === 'denied'} onClick={() => setConsent('denied')}>
          {t('consent.decline')}
        </button>
      </div>
    </aside>
  );
}
