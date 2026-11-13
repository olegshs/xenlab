import { create } from 'zustand';

/**
 * Google Analytics 4 with an explicit opt-in.
 *
 * Nothing is loaded and no cookies are set until the visitor allows it in the consent banner
 * (Consent Mode "basic": gtag.js is not even requested before that). Declining later turns
 * sending off and deletes the GA cookies. Without VITE_GA_ID the whole feature is off.
 */
const GA_ID = import.meta.env.VITE_GA_ID?.trim() ?? '';

/** A GA4 measurement ID such as G-XXXXXXXXXX (vite.config.ts rejects anything else at build time). */
export const isMeasurementId = (id: string) => /^G-[A-Z0-9]{4,}$/.test(id);

export const ANALYTICS_ENABLED = isMeasurementId(GA_ID);

export type Consent = 'granted' | 'denied';

const KEY = 'analytics-consent';

function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

interface ConsentState {
  consent: Consent | null;
  /** The banner is shown: no choice made yet, or reopened from the footer. */
  asking: boolean;
  setConsent(consent: Consent): void;
  /** Reopens the banner to change the choice. */
  ask(): void;
}

export const useConsent = create<ConsentState>((set) => ({
  consent: readConsent(),
  asking: ANALYTICS_ENABLED && readConsent() === null,
  setConsent: (consent) => {
    try {
      localStorage.setItem(KEY, consent);
    } catch {
      /* storage unavailable: the choice holds for this visit only */
    }
    set({ consent, asking: false });
    apply(consent);
  },
  ask: () => set({ asking: true }),
}));

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

type Gtag = (...args: unknown[]) => void;
let gtag: Gtag | null = null;

/** gtag's documented switch that stops all sending for a measurement ID. */
const setDisabled = (off: boolean) => {
  (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = off;
};

function load() {
  window.dataLayer = window.dataLayer || [];
  // gtag.js reads the `arguments` objects pushed here, so this cannot be an arrow function.
  gtag = function () {
    window.dataLayer!.push(arguments);
  };
  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  gtag('js', new Date());
  gtag('config', GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}

function apply(consent: Consent) {
  if (!ANALYTICS_ENABLED) return;
  if (consent === 'granted') {
    setDisabled(false);
    if (gtag) gtag('consent', 'update', { analytics_storage: 'granted' });
    else load();
  } else {
    setDisabled(true);
    gtag?.('consent', 'update', { analytics_storage: 'denied' });
    deleteGaCookies();
  }
}

/** Sends a GA4 event; does nothing without consent or without a measurement ID. */
export function track(name: string, params: Record<string, string | number> = {}) {
  if (gtag && useConsent.getState().consent === 'granted') gtag('event', name, params);
}

/**
 * Domains a cookie for `hostname` may have been set on: host-only ('') and every parent domain
 * ('.app.example.com', '.example.com'). GA puts its cookies on the highest one it can.
 */
export function cookieDomains(hostname: string): string[] {
  const parts = hostname.split('.');
  const out = [''];
  for (let i = 0; i < parts.length - 1; i++) out.push(`.${parts.slice(i).join('.')}`);
  return out;
}

function deleteGaCookies() {
  const names = document.cookie
    .split(';')
    .map((c) => c.split('=')[0].trim())
    .filter((name) => name === '_ga' || name.startsWith('_ga_'));
  for (const name of names) {
    for (const domain of cookieDomains(location.hostname)) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain ? `; domain=${domain}` : ''}`;
    }
  }
}

// Consent given on an earlier visit: start right away.
if (ANALYTICS_ENABLED && readConsent() === 'granted') load();
