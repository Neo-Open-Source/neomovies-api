import React from "react";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import clsx from "clsx";
import { translations, type FeatureItem } from "../data/translations";
import styles from "./index.module.css";

// SVG icons — inline, no external deps, theme-aware via currentColor
const Icons: Record<string, React.FC<{ className?: string }>> = {
  lock: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  film: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="17" x2="22" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
    </svg>
  ),
  play: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
    </svg>
  ),
  star: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  magnet: ({ className }) => (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
      <circle cx="24" cy="24" r="21.5" />
      <path d="m42.9438,34.1764h-22.0002c-4.4846,0-8.12-3.6355-8.12-8.12s3.6355-8.12,8.12-8.12c2.2423,0,4.2723.9089,5.7417,2.3783" />
      <path d="m41.1118,37.0185h-20.1682c-6.0542,0-10.9621-4.9079-10.9621-10.9621s4.9079-10.9621,10.9621-10.9621c1.4863,0,2.9036.2958,4.1961.8318" />
      <path d="m38.5148,39.8605h-17.5712c-7.6238,0-13.8041-6.1803-13.8041-13.8041s6.1803-13.8041,13.8041-13.8041" />
    </svg>
  ),
  zap: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
};

const iconKeys = ["lock", "film", "play", "star", "magnet", "zap"];

function Feature({ icon, title, description }: FeatureItem) {
  const Icon = Icons[icon];
  return (
    <div className={clsx("col col--4", styles.featureCard)}>
      <div className={styles.featureIconWrap}>
        {Icon && <Icon className={styles.featureIcon} />}
      </div>
      <Heading as="h3" className={styles.featureTitle}>{title}</Heading>
      <p className={styles.featureDesc}>{description}</p>
    </div>
  );
}

export default function Home(): React.JSX.Element {
  const { siteConfig, i18n } = useDocusaurusContext();
  const t = translations[i18n.currentLocale] ?? translations["en"];

  return (
    <Layout title={siteConfig.title} description={t.heroSubtitle}>
      <header className={styles.heroBanner}>
        <div className="container">
          <Heading as="h1" className={styles.heroTitle}>
            {t.heroTitle} <span className={styles.highlight}>v2</span>
          </Heading>
          <p className={styles.heroSubtitle}>{t.heroSubtitle}</p>
          <div className={styles.buttons}>
            <Link className="button button--secondary button--lg" to="/docs">
              {t.btnGetStarted}
            </Link>
            <Link className={clsx("button button--lg", styles.btnOutline)} to="/api">
              {t.btnApiRef}
            </Link>
          </div>
          <div className={styles.baseUrl}>
            <code>https://api.neomovies.ru/api/v1</code>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              {t.features.map((f, i) => (
                <Feature key={f.title} {...f} icon={iconKeys[i]} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
