import { useEffect } from 'react';

type LoadingScreenProps = {
  title?: string;
  subtitle?: string;
};

export function LoadingScreen({
  title = 'Loading SurvivalKendy',
  subtitle = 'Preparing live server status...',
}: LoadingScreenProps) {
  useEffect(() => {
    document.body.classList.add('is-page-loading');

    return () => {
      document.body.classList.remove('is-page-loading');
    };
  }, []);

  return (
    <div
      className="site-skeleton-loader"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="site-skeleton-frame">
        <section className="site-skeleton-video-hero" aria-hidden="true">
          <div className="site-skeleton-nav">
            <div className="site-skeleton-brand" />
            <div className="site-skeleton-nav-items">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="site-skeleton-hero-content">
            <div className="site-skeleton-stack">
              <div className="site-skeleton-kicker" />
              <div className="site-skeleton-title site-skeleton-title--wide" />
              <div className="site-skeleton-title" />
              <div className="site-skeleton-copy" />
              <div className="site-skeleton-actions">
                <span />
                <span />
              </div>
            </div>
            <div className="site-skeleton-video-mark" />
          </div>
        </section>

        <section className="site-skeleton-command" aria-hidden="true">
          <div className="site-skeleton-command-copy">
            <div className="site-skeleton-kicker site-skeleton-kicker--short" />
            <div className="site-skeleton-title site-skeleton-title--command" />
            <div className="site-skeleton-copy site-skeleton-copy--command" />
            <div className="site-skeleton-status-line" />
          </div>

          <div className="site-skeleton-join-card">
            <div className="site-skeleton-card-head" />
            <div className="site-skeleton-ip" />
            <div className="site-skeleton-copy site-skeleton-copy--small" />
          </div>

          <div className="site-skeleton-stat-grid">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="site-skeleton-action-grid">
            <span />
            <span />
          </div>
        </section>

        <div className="site-skeleton-status">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      </div>
    </div>
  );
}
