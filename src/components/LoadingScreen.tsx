import { useEffect, useState } from 'react';

type LoadingScreenProps = {
  title?: string;
  subtitle?: string;
  progress?: number;
  checks?: Array<{ label: string; done: boolean }>;
};

export function LoadingScreen({
  title = 'Loading SurvivalKendy',
  subtitle = 'Preparing content and warming API data...',
  progress,
  checks,
}: LoadingScreenProps) {
  const [autoProgress, setAutoProgress] = useState(8);
  const [insightIndex, setInsightIndex] = useState(0);

  const controlled = typeof progress === 'number';
  const insights = [
    'Tips: Use a Pumpkin Head or a Player Head to hide youself from beeing seen in a Locator Bar!',
    'Funfact: This server started from Aternos!',
    'Funfact: This server started with 5 Friends playing Minecraft!',
    'Tips: Collect the Loot inside a Custom Structure for crazy stuff!',
  ];

  useEffect(() => {
    document.body.classList.add('is-page-loading');

    if (controlled) {
      return () => {
        document.body.classList.remove('is-page-loading');
      };
    }

    const id = window.setInterval(() => {
      setAutoProgress((value) => {
        if (value >= 94) return value;
        const step = value < 38 ? 7 : value < 72 ? 4 : 2;
        return Math.min(value + step, 94);
      });
    }, 180);

    return () => {
      window.clearInterval(id);
      document.body.classList.remove('is-page-loading');
    };
  }, [controlled]);

  const pct = Math.max(1, Math.min(100, Math.round(controlled ? (progress as number) : autoProgress)));
  const defaultSteps = [
    { label: 'Boot UI shell', done: pct >= 18 },
    { label: 'Warm status API', done: pct >= 46 },
    { label: 'Prepare page chunks', done: pct >= 76 },
    { label: 'Finalize render', done: pct >= 94 },
  ];
  const steps = checks && checks.length > 0 ? checks : defaultSteps;

  useEffect(() => {
    const id = window.setInterval(() => {
      setInsightIndex((value) => (value + 1) % insights.length);
    }, 1800);

    return () => {
      window.clearInterval(id);
    };
  }, [insights.length]);

  return (
    <div className="page-loader" role="status" aria-live="polite" aria-label="Loading page">
      <div className="page-loader-panel">
        <div className="page-loader-insights" aria-live="polite">
          <p className="page-loader-insights-title">Tips & Funfact</p>
          <p key={insightIndex} className="page-loader-insight">{insights[insightIndex]}</p>
        </div>
        <h1 className="page-loader-title">{title}</h1>

        <div className="page-loader-message">
          <p className="page-loader-message-kind">Boot Sequence</p>
          <p className="page-loader-message-text">{subtitle}</p>
        </div>

        <div className="page-loader-track">
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="page-loader-percent">{pct}%</p>

        <div className="page-loader-steps" aria-label="Loading steps">
          {steps.map((item) => {
            return (
              <p key={item.label} className="page-loader-step">
                <span>{item.label}</span>
                <strong className={item.done ? 'is-done' : ''}>{item.done ? 'Done' : 'Pending'}</strong>
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}
