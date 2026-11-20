import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite';

const SHARE = {
  title: 'XenLab – Microtonal sandbox',
  description:
    'Play any tuning in the browser – 19-EDO, 31-EDO, Bohlen–Pierce, just intonation, Scala files – from your keyboard, with chord demos and a melody generator.',
  image: '/og-image.png',
  imageAlt: 'XenLab: a ring of coloured scale degrees around an X, with the tagline "Microtonal sandbox".',
  imageWidth: 1200,
  imageHeight: 630,
};

const LICENSE_URL = 'https://www.gnu.org/licenses/agpl-3.0.html';

/** VITE_SITE_URL without surrounding spaces and trailing slashes ('' when not set). */
const normalizeSite = (siteUrl: string) => siteUrl.trim().replace(/\/+$/, '');

/**
 * Adds description, Open Graph and Twitter card tags to index.html.
 * With VITE_SITE_URL set, links become absolute and og:url, canonical and schema.org data
 * for search engines are added (most social networks ignore relative image URLs).
 */
function shareMeta(site: string): Plugin {
  const abs = (path: string) => (site ? `${site}${path}` : path);
  const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({ tag: 'meta', attrs, injectTo: 'head' });
  const og = (property: string, content: string | number) => meta({ property, content: String(content) });
  const tw = (name: string, content: string) => meta({ name, content });

  const tags: HtmlTagDescriptor[] = [
    meta({ name: 'description', content: SHARE.description }),
    og('og:type', 'website'),
    og('og:site_name', 'XenLab'),
    og('og:title', SHARE.title),
    og('og:description', SHARE.description),
    og('og:locale', 'en_US'),
    og('og:image', abs(SHARE.image)),
    og('og:image:type', 'image/png'),
    og('og:image:width', SHARE.imageWidth),
    og('og:image:height', SHARE.imageHeight),
    og('og:image:alt', SHARE.imageAlt),
    tw('twitter:card', 'summary_large_image'),
    tw('twitter:title', SHARE.title),
    tw('twitter:description', SHARE.description),
    tw('twitter:image', abs(SHARE.image)),
    tw('twitter:image:alt', SHARE.imageAlt),
  ];
  if (site) {
    tags.push(og('og:url', `${site}/`), { tag: 'link', attrs: { rel: 'canonical', href: `${site}/` }, injectTo: 'head' });
    const app = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'XenLab',
      url: `${site}/`,
      description: SHARE.description,
      image: abs(SHARE.image),
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires a browser with the Web Audio API',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
      license: LICENSE_URL,
    };
    // Escaping "<" keeps a "</script>" inside a string from ending the tag early.
    const json = JSON.stringify(app).replace(/</g, '\\u003c');
    tags.push({ tag: 'script', attrs: { type: 'application/ld+json' }, children: json, injectTo: 'head' });
  }
  return { name: 'xenlab-share-meta', transformIndexHtml: () => tags };
}

/**
 * With VITE_SITE_URL set, emits sitemap.xml and a copy of public/robots.txt that points to it.
 * A Sitemap line must hold an absolute URL, so the static file in public/ cannot have one itself.
 */
function crawlerFiles(site: string): Plugin {
  let publicDir = '';
  return {
    name: 'xenlab-crawler-files',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    async generateBundle() {
      if (!site) return;
      const robots = await this.fs.readFile(`${publicDir}/robots.txt`, { encoding: 'utf8' });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `${robots.trimEnd()}\n\nSitemap: ${site}/sitemap.xml\n`,
      });
      const lastmod = new Date().toISOString().slice(0, 10);
      const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        `  <url><loc>${xmlEscape(`${site}/`)}</loc><lastmod>${lastmod}</lastmod></url>`,
        '</urlset>',
        '',
      ].join('\n');
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap });
    },
  };
}

const xmlEscape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

/** Fails the build on an ID the app would silently ignore (same check as ANALYTICS_ENABLED in src/analytics.ts). */
function checkGaId(id: string) {
  if (!id || /^G-[A-Z0-9]{4,}$/.test(id)) return;
  const hint = id.startsWith('GTM-')
    ? ' This is a Google Tag Manager container ID; use the measurement ID of the GA4 web data stream instead' +
      ' (Google Analytics → Admin → Data streams).'
    : '';
  throw new Error(`VITE_GA_ID must be a GA4 measurement ID like G-XXXXXXXXXX, got "${id}".${hint}`);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  checkGaId(env.VITE_GA_ID?.trim() ?? '');
  const site = normalizeSite(env.VITE_SITE_URL ?? '');
  return {
    plugins: [react(), shareMeta(site), crawlerFiles(site)],
    server: { port: 5173 },
  };
});
