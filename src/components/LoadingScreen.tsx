import { useEffect, useState } from 'react';
import { assetUrl } from '../lib/asset-url';
import { Card } from './ui/card';

type LoadingScreenProps = {
  title?: string;
  subtitle?: string;
};

export function LoadingScreen({
  title = 'Loading SurvivalKendy',
  subtitle = 'Preparing content and warming API data...',
}: LoadingScreenProps) {
  const [insightIndex, setInsightIndex] = useState(0);
  const insights = [
    'Tip: Pumpkin heads can hide your locator marker.',
    'Tip: Explore custom structures for rare loot.',
    'Fun fact: SurvivalKendy started from a small friend group.',
  ];

  useEffect(() => {
    document.body.classList.add('is-page-loading');

    return () => {
      document.body.classList.remove('is-page-loading');
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setInsightIndex((value) => (value + 1) % insights.length);
    }, 1900);

    return () => window.clearInterval(id);
  }, [insights.length]);

  return (
    <div
      className="page-loader"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <Card className="page-loader-panel page-loader-card">
        <img
          src={assetUrl('/assets/icon.png')}
          alt="SurvivalKendy logo"
          className="page-loader-logo"
          width={112}
          height={112}
          decoding="async"
          fetchPriority="high"
        />
        <div className="page-loader-pingpong-shell" aria-hidden="true">
          <div className="page-loader-pingpong-track">
            <span
              className="page-loader-pingpong-line"
              style={{ animation: 'pingPongLoader 1400ms ease-in-out infinite alternate' }}
            />
          </div>
        </div>
        <h1 className="page-loader-title">
          {title}
        </h1>
        <p className="page-loader-message-text">
          {subtitle}
        </p>
        <p key={insightIndex} className="page-loader-insight page-loader-insight-minimal">{insights[insightIndex]}</p>
      </Card>
    </div>
  );
}
