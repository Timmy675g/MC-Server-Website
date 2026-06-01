import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Archive, Check, Copy, ExternalLink, ShieldAlert } from 'lucide-react';
import { assetUrl } from '../lib/asset-url';
import { CURRENT_FACTION_ITEMS, NEWS_ITEMS, PREVIOUS_FACTION_ITEMS, formatDate } from '../lib/content';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { usePollingStatus } from '../hooks/usePollingStatus';
import { MotionReveal } from '../components/MotionReveal';

const NEWS_ROTATE_MS = 6200;
const SERVER_IP = 'play.survivalkendy.systems';
const STATUS_PAGE_URL = import.meta.env.VITE_STATUS_PAGE_URL || 'https://status.survivalkendy.systems';
const INCIDENT_PORTAL_URL = import.meta.env.VITE_INCIDENT_PORTAL_URL || 'https://tickets.survivalkendy.systems';
const ARCHIVE_SITE_URL = 'https://archive.survivalkendy.systems';
const ARCHIVE_SHUTDOWN_TARGET = '2026-06-02T20:00:00+07:00';

type ArchiveCountdownState = {
  totalMs: number;
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

function getArchiveCountdownState(): ArchiveCountdownState {
  const remaining = Math.max(0, new Date(ARCHIVE_SHUTDOWN_TARGET).getTime() - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    totalMs: remaining,
    days: String(days),
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  };
}

function statusTone(status: string): string {
  if (status === 'online') return 'status-online';
  if (status === 'maintenance' || status === 'degraded') return 'status-pinging';
  return 'status-offline';
}

function statusLabel(status: string): 'Operational' | 'Maintenance' | 'Down' {
  if (status === 'online') return 'Operational';
  if (status === 'maintenance' || status === 'degraded') return 'Maintenance';
  return 'Down';
}

function SplitFlapCountdown() {
  const [countdown, setCountdown] = useState<ArchiveCountdownState>(() => getArchiveCountdownState());

  useEffect(() => {
    const id = window.setInterval(() => {
      setCountdown(getArchiveCountdownState());
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  if (countdown.totalMs <= 0) {
    return (
      <div className="archive-splitflap-fallback" role="status" aria-live="polite">
        Server Shutdown In Progress
      </div>
    );
  }

  const segments = [
    { label: 'Days', value: countdown.days },
    { label: 'Hours', value: countdown.hours },
    { label: 'Minutes', value: countdown.minutes },
    { label: 'Seconds', value: countdown.seconds },
  ];

  return (
    <div className="archive-splitflap" role="timer" aria-live="polite" aria-label="Server shutdown countdown">
      {segments.map((segment) => (
        <div className="archive-splitflap-segment" key={segment.label}>
          <span className="archive-splitflap-tile" aria-hidden="true">
            <span className="archive-splitflap-value" key={segment.value}>{segment.value}</span>
          </span>
          <span className="archive-splitflap-label">{segment.label}</span>
          <span className="sr-only">{segment.value} {segment.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const {
    status,
    isLoading: isStatusLoading,
    isError: isStatusError,
    isStale: isStatusStale,
    lastUpdatedLabel,
    lastError,
  } = usePollingStatus();
  const typingWords = useMemo(
    () => ['SurvivalKendy Minecraft Server', 'War or Peace Situations', 'Creativity, Strategy, Community.'],
    [],
  );
  const [typingIndex, setTypingIndex] = useState(0);
  const [typingValue, setTypingValue] = useState('');
  const [railIndex, setRailIndex] = useState(0);
  const [railResetToken, setRailResetToken] = useState(0);
  const [isRailPaused, setIsRailPaused] = useState(false);
  const [railAnim, setRailAnim] = useState<'swipe-left' | 'swipe-right'>('swipe-left');
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const liteMode = useMemo(() => {
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean };
      deviceMemory?: number;
      hardwareConcurrency?: number;
    };

    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const narrowScreen = window.matchMedia('(max-width: 980px)').matches;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = Boolean(nav.connection?.saveData);
    const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
    const lowCpu = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 6;

    return coarsePointer || narrowScreen || reduceMotion || saveData || lowMemory || lowCpu;
  }, []);

  useEffect(() => {
    if (liteMode) {
      // In lite mode, just show the first phrase statically.
      setTypingValue(typingWords[typingIndex] ?? '');
      return;
    }

    const text = typingWords[typingIndex] ?? '';
    let frame = 0;
    let deleting = false;
    let cancelled = false;
    let timerId: number | null = null;

    // Reset visible value when this cycle begins so we never
    // briefly render the previous word's leftover characters.
    setTypingValue('');

    const schedule = (delay: number) => {
      if (cancelled) return;
      timerId = window.setTimeout(tick, delay);
    };

    const tick = () => {
      if (cancelled) return;

      if (!deleting) {
        frame += 1;
        setTypingValue(text.slice(0, frame));

        if (frame >= text.length) {
          deleting = true;
          schedule(1100); // pause at full word
          return;
        }

        schedule(52);
      } else {
        frame -= 1;
        setTypingValue(text.slice(0, Math.max(frame, 0)));

        if (frame <= 0) {
          // Advance to next word; this effect will re-run with the new index.
          setTypingIndex((value) => (value + 1) % typingWords.length);
          return;
        }

        schedule(34);
      }
    };

    // Initial delay before the first character appears.
    schedule(220);

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    };
  }, [liteMode, typingIndex, typingWords]);

  useEffect(() => {
    const video = document.querySelector('.home-intro-video');
    if (!(video instanceof HTMLVideoElement)) return;

    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');

    const tryPlay = () => {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Autoplay can be blocked on some devices until user interaction.
        });
      }
    };

    if (liteMode) {
      video.pause();
      video.removeAttribute('src');
      video.querySelectorAll('source').forEach((source) => source.removeAttribute('src'));
      video.load();
      return;
    }

    const onUserGesture = () => tryPlay();
    const onVisible = () => {
      if (!document.hidden) tryPlay();
    };

    video.addEventListener('loadeddata', tryPlay);
    video.addEventListener('canplay', tryPlay);
    window.addEventListener('pointerdown', onUserGesture, { passive: true });
    window.addEventListener('touchstart', onUserGesture, { passive: true });
    window.addEventListener('keydown', onUserGesture);
    document.addEventListener('visibilitychange', onVisible);

    // Retry autoplay a few times for browsers that delay media readiness.
    const t1 = window.setTimeout(tryPlay, 120);
    const t2 = window.setTimeout(tryPlay, 700);
    const t3 = window.setTimeout(tryPlay, 1600);
    tryPlay();

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      video.removeEventListener('loadeddata', tryPlay);
      video.removeEventListener('canplay', tryPlay);
      window.removeEventListener('pointerdown', onUserGesture);
      window.removeEventListener('touchstart', onUserGesture);
      window.removeEventListener('keydown', onUserGesture);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [liteMode]);

  useEffect(() => {
    const intro = document.querySelector('.home-intro');
    if (!(intro instanceof HTMLElement)) return;

    let frame = 0;

    const updateNavState = () => {
      frame = 0;

      const introBottom = intro.getBoundingClientRect().bottom;
      const revealOffset = 74;

      if (introBottom <= revealOffset) {
        document.body.classList.remove('home-intro-nav-hidden');
        document.body.classList.add('home-intro-nav-visible');
      } else {
        document.body.classList.add('home-intro-nav-hidden');
        document.body.classList.remove('home-intro-nav-visible');
      }
    };

    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateNavState);
    };

    scheduleUpdate();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      document.body.classList.remove('home-intro-nav-hidden', 'home-intro-nav-visible');
    };
  }, []);

  const cards = useMemo(() => {
    const liveStatus = statusLabel(status?.status ?? 'offline');
    const bestPing = [status?.javaPing, status?.bedrockPing]
      .filter((value): value is number => Number.isFinite(Number(value)))
      .sort((a, b) => a - b)[0];
    const tpsMspt = status?.tps !== null && status?.tps !== undefined
      ? `${Number(status.tps).toFixed(1)} TPS`
      : status?.mspt !== null && status?.mspt !== undefined
        ? `${Math.round(Number(status.mspt))} MSPT`
        : '--';

    return [
      {
        label: 'Status',
        value: isStatusLoading && !status ? 'Loading' : liveStatus,
        className: `${statusTone(status?.status ?? '')} ${isStatusStale ? 'is-stale-value' : ''}`.trim(),
        tooltip: 'Live server status — Operational means the server is online and accepting connections.',
      },
      {
        label: 'Current Players',
        value:
          status && Number.isFinite(status.playersOnline) && Number.isFinite(status.playersMax)
            ? `${status.playersOnline} / ${status.playersMax}`
            : '-- / --',
        className: '',
        tooltip: 'Players currently online out of the maximum player cap.',
      },
      {
        label: 'Latency',
        value: bestPing !== undefined ? `${Math.round(bestPing)} ms` : '--',
        className: '',
        tooltip: 'Lowest available Java or Bedrock ping from the latest status poll.',
      },
      {
        label: 'TPS / MSPT',
        value: tpsMspt,
        className: '',
        tooltip: 'Server TPS or MSPT if the status API exposes it.',
      },
      {
        label: 'Factions',
        value: `${CURRENT_FACTION_ITEMS.length}`,
        className: '',
        tooltip: 'Number of active factions in the current server season.',
      },
      {
        label: 'Location',
        value: '🇸🇬 Singapore',
        className: '',
        tooltip: 'Server hosted in Singapore for low-latency connections across Southeast Asia.',
      },
    ];
  }, [isStatusLoading, isStatusStale, status]);

  const statusDescription = isStatusLoading && !status
    ? 'Checking live server data...'
    : isStatusError
      ? 'Live checks are failing. Last known data remains visible.'
      : isStatusStale
        ? 'Data is older than expected. The last known values are still shown.'
        : status?.status === 'online'
          ? 'Server is responding to live status probes.'
          : status?.status === 'maintenance'
            ? 'Maintenance mode is active.'
            : 'Server is currently reporting offline.';

  const recentNews = useMemo(
    () => [...NEWS_ITEMS].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4),
    [],
  );

  useEffect(() => {
    if (recentNews.length <= 1) return;
    if (isRailPaused) return;
    if (liteMode) return;

    const id = window.setTimeout(() => {
      setRailAnim('swipe-left');
      setRailIndex((value) => (value + 1) % recentNews.length);
    }, NEWS_ROTATE_MS);

    return () => window.clearTimeout(id);
  }, [recentNews.length, railIndex, railResetToken, isRailPaused, liteMode]);

  useEffect(() => {
    const preloadItems = liteMode ? recentNews.slice(0, 1) : recentNews;
    const preload = preloadItems.map((item) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = assetUrl(item.thumbnail);
      return image;
    });

    return () => {
      preload.forEach((image) => {
        image.src = '';
      });
    };
  }, [recentNews, liteMode]);

  const activeNews = recentNews[railIndex] ?? null;

  const goToNewsIndex = (nextIndex: number) => {
    if (recentNews.length <= 1) return;

    const total = recentNews.length;
    const normalized = ((nextIndex % total) + total) % total;
    const current = railIndex;

    const forwardDistance = (normalized - current + total) % total;
    const backwardDistance = (current - normalized + total) % total;

    setRailAnim(forwardDistance <= backwardDistance ? 'swipe-left' : 'swipe-right');
    setRailIndex(normalized);
    setRailResetToken((value) => value + 1);
  };

  const topFactions = useMemo(
    () => [...PREVIOUS_FACTION_ITEMS].sort((a, b) => b.power - a.power).slice(0, 3),
    [],
  );
  const copyServerIp = async () => {
    try {
      await navigator.clipboard.writeText(SERVER_IP);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }

    window.setTimeout(() => setCopyState('idle'), 2400);
  };

  return (
    <>
      <section className="archive-mode-banner" aria-labelledby="archive-mode-title">
        <div className="archive-mode-card container">
          <div className="archive-mode-icon" aria-hidden="true">
            <Archive size={24} />
          </div>

          <div className="archive-mode-copy">
            <div className="archive-mode-meta">
              <span className="archive-mode-badge">Archive Mode</span>
              <span className="archive-mode-countdown">Server shutdown planned: Tomorrow</span>
            </div>
            <h2 id="archive-mode-title">SurvivalKendy Has Entered Archive Mode</h2>
            <p>
              Due to current funding and infrastructure limitations, SurvivalKendy is currently in Archive Mode.
              The Minecraft server is scheduled to shut down tomorrow unless a sustainable hosting solution becomes available.
            </p>
            <SplitFlapCountdown />
            <div className="archive-mode-preserving" aria-label="Archive preservation list">
              <span>World downloads</span>
              <span>Screenshots and memories</span>
              <span>Project documentation</span>
              <span>Infrastructure notes</span>
            </div>
            <p className="archive-mode-note">
              The archive website is now being prepared and will become the permanent home of the project's history.
            </p>
          </div>

          <div className="archive-mode-actions">
            <a className="archive-mode-primary" href={ARCHIVE_SITE_URL}>
              Visit Archive Website
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section className="home-intro" aria-label="Intro video">
        <video className="home-intro-video" autoPlay muted loop playsInline preload="metadata" poster={assetUrl('/assets/icon.png')}>
          <source src={assetUrl('/assets/Video.mp4')} type="video/mp4" />
        </video>
        <div className="home-intro-overlay" />
        <div className="home-intro-content container">
          <Badge variant="outline" className="home-intro-badge shadcn-float">SurvivalKendy • Community Server</Badge>
          <p className="home-intro-kicker">
            <span className="brand-survival">Survival</span><span className="brand-kendy">Kendy</span>{' '}
            <span className="brand-minecraft">Minecraft</span>{' '}
            <span className="brand-server">Server</span>
          </p>
          <h1>Where Strategy Shapes the World.</h1>
          <p>Build alliances, lead your faction, and create stories worth remembering.</p>
          <div className="button-group home-intro-actions">
            <Button asChild variant="primary" size="lg" className="shadcn-glow home-cta-btn">
              <Link to="/join">Enter Server</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="home-cta-btn">
              <a href="#home-content">Explore Site</a>
            </Button>
          </div>
          <a className="home-intro-scroll" href="#home-content" aria-label="Scroll to content">
            <span />
            <strong className="intro-cue-desktop">SCROLL</strong>
            <strong className="intro-cue-mobile">SWIPE UP</strong>
          </a>
        </div>
      </section>

      <header className="hero home-command-center container reveal in-view" id="home-content">
        <div className="hero-grid home-command-grid">
          <div className="home-command-copy">
            <p className="eyebrow">Server Command Center</p>
            <h2 className="home-typing-headline" data-typing-list="SurvivalKendy Minecraft Server|War or Peace Situations|Creativity, Strategy, Community.">{typingValue}</h2>
            <p className="subtitle">Live connection details, server health, and the fastest path into SurvivalKendy.</p>
            <div className={`live-status-strip ${isStatusStale ? 'is-stale' : ''} ${isStatusError ? 'is-error' : ''}`} role="status" aria-live="polite">
              <span className="live-status-dot" aria-hidden="true" />
              <strong>{isStatusLoading && !status ? 'Loading' : isStatusStale ? 'Stale' : status?.status === 'offline' ? 'Offline' : 'Live'}</strong>
              <span>Last updated {lastUpdatedLabel}</span>
              {isStatusError ? <span>{lastError || 'Live data is temporarily unavailable.'}</span> : null}
            </div>
            <div className="button-group home-command-actions">
              <Button asChild variant="primary" className="shadcn-glow home-cta-btn">
                <Link to="/join">Join Now</Link>
              </Button>
              <Button asChild variant="default" className="home-cta-btn home-cta-btn--secondary">
                <Link to="/news">Read the News</Link>
              </Button>
              <Button asChild variant="outline" className="home-cta-btn home-cta-btn--tertiary">
                <Link to="/rules">View Rules</Link>
              </Button>
            </div>
          </div>
          <Card className="home-server-card shadcn-card-lift" aria-label="How to join SurvivalKendy">
            <div className="home-server-card-head">
              <img
                src={assetUrl('/assets/icon.png')}
                alt=""
                aria-hidden="true"
                className="home-server-card-icon"
                decoding="async"
                fetchPriority="high"
              />
              <div className="home-server-card-meta">
                <span className="home-server-card-label">Java &amp; Bedrock</span>
                <strong className="home-server-card-name">SurvivalKendy</strong>
                <span className="home-server-card-tagline">Open community server</span>
              </div>
            </div>
            <div className="home-server-card-ip-block copy-ip-container">
              <span className="home-server-card-ip-label">Play Now</span>
              <div
                className={`ip-copy-box ${copyState === 'copied' ? 'copied' : ''} ${copyState === 'failed' ? 'copy-failed' : ''}`.trim()}
                onClick={copyServerIp}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    void copyServerIp();
                  }
                }}
                title="Click to copy IP"
                role="button"
                tabIndex={0}
                aria-label="Copy SurvivalKendy server IP"
              >
                <div className="ip-text-wrap">
                  <span className="ip-text">{SERVER_IP}</span>
                </div>
                <span className="ip-copy-indicator" aria-hidden="true">
                  <Copy size={16} className="icon-copy" />
                  <Check size={16} className="icon-check" />
                </span>
              </div>
              <p className="home-server-card-ip-note" role="status" aria-live="polite">
                {copyState === 'copied'
                  ? 'IP copied. Open Minecraft, add SurvivalKendy, and join.'
                  : copyState === 'failed'
                    ? 'Copy failed. Select the IP and copy it manually.'
                    : 'No whitelist required. Copy the IP address and hop right in!'}
              </p>
            </div>
          </Card>
        </div>

        <div className="stats-grid home-redesign-stats" id="home-live-stats">
          {cards.map((card, index) => (
            <MotionReveal key={card.label} className="stat-motion-card" delay={index * 0.035}>
              <Card
                className={`stat-box shadcn-card-lift ${status?.status === 'offline' ? 'is-offline-card' : ''} ${isStatusStale ? 'is-stale-card' : ''} ${isStatusError ? 'is-error-card' : ''}`.trim()}
                style={{ animationDelay: `${index * 80}ms` }}
                title={card.tooltip}
              >
                <span className="stat-label">
                  {card.label}
                  {card.tooltip && (
                    <span className="stat-tooltip-icon" aria-label={card.tooltip}>(?)</span>
                  )}
                </span>
                <span className={`stat-value ${card.className}`}>{card.value}</span>
              </Card>
            </MotionReveal>
          ))}
        </div>

        <MotionReveal className="status-actions-grid" delay={0.1}>
          <Card className={`status-action-card ${isStatusError ? 'is-error-card' : isStatusStale ? 'is-stale-card' : ''}`.trim()}>
            <div className="status-action-icon" aria-hidden="true">
              {isStatusError ? <AlertTriangle size={18} /> : <Activity size={18} />}
            </div>
            <div>
              <p className="status-action-label">Live Status</p>
              <h3>{isStatusStale ? 'Last Known Data' : 'Server Health'}</h3>
              <p className="meta">{statusDescription}</p>
            </div>
            <a className="link-arrow status-action-link" href={STATUS_PAGE_URL} target="_blank" rel="noreferrer">
              Status Page <ExternalLink size={14} aria-hidden="true" />
            </a>
          </Card>

          <Card className="status-action-card">
            <div className="status-action-icon" aria-hidden="true">
              <ShieldAlert size={18} />
            </div>
            <div>
              <p className="status-action-label">Operations</p>
              <h3>Incident Portal</h3>
              <p className="meta">Review maintenance controls and incident context.</p>
            </div>
            <a className="link-arrow status-action-link" href={INCIDENT_PORTAL_URL} target="_blank" rel="noreferrer">
              Open Portal <ExternalLink size={14} aria-hidden="true" />
            </a>
          </Card>
        </MotionReveal>
      </header>

      <section className="container reveal in-view section">
        <p className="home-section-eyebrow">Why SurvivalKendy</p>
        <h2>What Makes Us Different</h2>
        <div className="home-features-bento">
          <MotionReveal className="home-features-motion home-features-motion--accent"><Card className="home-features-card home-features-card--accent shadcn-card-lift">
            <span className="home-features-icon" aria-hidden="true">OPS</span>
            <h3>No BS Hosting</h3>
            <p>We've been running Minecraft servers for long enough to know what works. Expect zero lag blocks, minimal downtime, and admins who actually play the game.</p>
          </Card></MotionReveal>
          <MotionReveal className="home-features-motion" delay={0.04}><Card className="home-features-card shadcn-card-lift">
            <span className="home-features-icon" aria-hidden="true">LOG</span>
            <h3>Player-Written Lore</h3>
            <p>Every war, alliance, and betrayal gets recorded by the players. You literally write the server's history as it happens using our custom website integrations.</p>
          </Card></MotionReveal>
          <MotionReveal className="home-features-motion home-features-motion--specs" delay={0.08}><Card className="home-features-card shadcn-card-lift">
            <span className="home-features-icon" aria-hidden="true">TPS</span>
            <h3>Beefy Hardware</h3>
            <p className="home-features-card-lead">Hosted on heavy-duty cloud infrastructure because nobody likes rubberbanding.</p>
            <ul className="home-features-specs">
              <li><strong>~15 ms</strong><span>avg ping</span></li>
              <li><strong>20 TPS</strong><span>steady tick rate</span></li>
              <li><strong>4 vCPU</strong><span>Dedicated</span></li>
              <li><strong>8 GB</strong><span>RAM</span></li>
              <li><strong>80 GB</strong><span>NVMe Storage</span></li>
              <li><strong>30</strong><span>player cap</span></li>
            </ul>
          </Card></MotionReveal>
          <MotionReveal className="home-features-motion" delay={0.12}><Card className="home-features-card shadcn-card-lift">
            <span className="home-features-icon" aria-hidden="true">SEA</span>
            <h3>Tight-knit Community</h3>
            <p>A thriving group of friends, builders, and strategists. No arbitrary toxicity or random griefers—just people having a genuinely good time together.</p>
          </Card></MotionReveal>
        </div>
      </section>

      <section className="container reveal in-view section">
        <div className="section-head">
          <h2>Recent News</h2>
          <Link to="/news" className="link-arrow">See all news -&gt;</Link>
        </div>
        <div className="card-grid" id="recent-news">
          <section
            className="news-rail"
            aria-label="Recent news highlights"
            onMouseEnter={() => setIsRailPaused(true)}
            onMouseLeave={() => setIsRailPaused(false)}
            onFocusCapture={() => setIsRailPaused(true)}
            onBlurCapture={() => setIsRailPaused(false)}
          >
            <div className="news-rail-head">
              <div className="news-rail-tabs" role="tablist" aria-label="News highlights">
                {recentNews.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    className={`news-rail-tab ${index === railIndex ? 'is-active' : ''} ${index === railIndex && !isRailPaused ? 'is-running' : ''}`.trim()}
                    onClick={() => goToNewsIndex(index)}
                    aria-selected={index === railIndex ? 'true' : 'false'}
                    aria-label={item.title}
                  >
                    <span>{item.topic ?? item.id}</span>
                  </button>
                ))}
              </div>
              <Link className="news-rail-see-all" to="/news">See all</Link>
            </div>

            {activeNews ? (
              <article
                key={activeNews.id}
                className={`news-rail-stage ${railAnim}`}
                aria-live="polite"
                onTouchStart={(event) => {
                  const touch = event.touches[0];
                  if (!touch) return;
                  setTouchStart({ x: touch.clientX, y: touch.clientY });
                }}
                onTouchEnd={(event) => {
                  if (!touchStart) return;
                  const touch = event.changedTouches[0];
                  if (!touch) return;

                  const deltaX = touch.clientX - touchStart.x;
                  const deltaY = touch.clientY - touchStart.y;
                  const absX = Math.abs(deltaX);
                  const absY = Math.abs(deltaY);
                  setTouchStart(null);

                  if (absX < 52 || absX <= absY * 1.2) return;
                  if (deltaX < 0) {
                    goToNewsIndex(railIndex + 1);
                  } else {
                    goToNewsIndex(railIndex - 1);
                  }
                }}
              >
                <img className="news-rail-media" src={assetUrl(activeNews.thumbnail)} alt={activeNews.title} loading="lazy" decoding="async" />
                <div className="news-rail-overlay" />
                <div className="news-rail-content">
                  <p className="news-rail-kicker">{activeNews.id}</p>
                  <h3>{activeNews.title}</h3>
                  <p className="meta">{activeNews.author} • {formatDate(activeNews.date)}</p>
                  <p className="news-rail-preview">{activeNews.preview}</p>
                  <p><Link className="link-arrow" to={`/news/${encodeURIComponent(activeNews.id)}`}>Read article -&gt;</Link></p>
                </div>
              </article>
            ) : null}
          </section>
        </div>
      </section>

      <section className="container reveal in-view section">
        <div className="section-head">
          <div>
            <p className="home-section-eyebrow">Notable Teams</p>
            <h2>Factions to Know</h2>
          </div>
          <Link to="/factions" className="link-arrow">All factions -&gt;</Link>
        </div>
        <div className="home-factions-preview">
          {topFactions.map((faction) => (
            <Card key={faction.name} className="home-faction-card shadcn-card-lift">
              <div className="home-faction-card-head">
                <h3>{faction.name.replace(/:$/, '')}</h3>
                <span className="home-faction-power" aria-label={`Power level ${faction.power}`}>
                  PWR <strong>{faction.power}</strong>
                </span>
              </div>
              <p className="home-faction-desc">{faction.description}</p>
              <div className="home-faction-meta">
                <span><span className="meta">Leader</span><strong>{faction.leader}</strong></span>
                <span><span className="meta">Members</span><strong>{faction.members}</strong></span>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
