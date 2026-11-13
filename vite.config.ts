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

/**
 * Adds description, Open Graph and Twitter card tags to index.html.
 * With VITE_SITE_URL set, links become absolute and og:url / canonical are added
 * (most social networks ignore relative image URLs).
 */
function shareMeta(siteUrl: string): Plugin {
  const site = siteUrl.trim().replace(/\/+$/, '');
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
  }
  return { name: 'xenlab-share-meta', transformIndexHtml: () => tags };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    plugins: [react(), shareMeta(env.VITE_SITE_URL ?? '')],
    server: { port: 5173 },
  };
});
