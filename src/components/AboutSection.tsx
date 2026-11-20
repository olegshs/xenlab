import { useT } from '../i18n';

/**
 * A few paragraphs on what XenLab is and how to use it, below the panels. Besides helping
 * first-time visitors, this is the page's only running text, which search engines need to index it.
 */
export function AboutSection() {
  const t = useT();
  return (
    <section className="about" aria-labelledby="about-title">
      <h2 id="about-title">{t('about.title')}</h2>
      <div className="about-text">
        <p>{t('about.intro')}</p>
        <p>{t('about.tunings')}</p>
        <p>{t('about.play', { button: t('app.enableSound') })}</p>
        <p>{t('about.generator', { demo: t('gen.demo'), piece: t('gen.piece'), pump: t('gen.pump') })}</p>
        <p>{t('about.local')}</p>
      </div>
    </section>
  );
}
