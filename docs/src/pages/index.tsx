import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.scss'; // We will create this next!

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        {/* The Glitch C Favicon acting as the center logo */}
        <img src="/img/favicon.png" alt="Cinescope Logo" className={styles.heroLogo} />
        
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/users/">
            User Guide
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/developers/">
            Developer Architecture
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`Welcome to ${siteConfig.title}`}
      description="Official documentation for the Cinescope application and API.">
      <HomepageHeader />
    </Layout>
  );
}