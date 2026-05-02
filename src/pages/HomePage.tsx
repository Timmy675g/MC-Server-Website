import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { getStatus, getUptime } from '../lib/api';
import { assetUrl } from '../lib/asset-url';
import { CURRENT_FACTION_ITEMS, NEWS_ITEMS, PREVIOUS_FACTION_ITEMS, formatDate } from '../lib/content';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import type { ServerStatus, UptimeStats } from '../types/api';

const NEWS_ROTATE_MS = 6200;

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

export default function HomePage() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [uptime, setUptime] = useState<UptimeStats | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    let mounted = true;

    Promise.all([getStatus(), getUptime()])
      .then(([statusData, uptimeData]) => {
        if (!mounted) return;
        setStatus(statusData);
        setUptime(uptimeData);
      })
      .catch(() => {
        if (!mounted) return;
        setError('Live data is temporarily unavailable.');
      });

    return () => {
      mounted = false;
    };
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
      video.addEventListener('loadeddata', tryPlay);
      tryPlay();
      return () => {
        video.removeEventListener('loadeddata', tryPlay);
      };
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
    return [
      {
        label: 'Status',
        value: liveStatus,
        className: statusTone(status?.status ?? ''),
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
        label: 'Factions',
        value: `${CURRENT_FACTION_ITEMS.length}`,
        className: '',
        tooltip: 'Number of active factions in the current server season.',
      },
      {
        label: 'Uptime',
        value: uptime?.uptimePercent !== null && uptime?.uptimePercent !== undefined
          ? `${uptime.uptimePercent.toFixed(2)}%`
          : '--',
        className: 'uptime-good',
        tooltip: 'Percentage of time the server has been online over the last 90 days.',
      },
      {
        label: 'Location',
        value: '🇸🇬 Singapore',
        className: '',
        tooltip: 'Server hosted in Singapore for low-latency connections across Southeast Asia.',
      },
    ];
  }, [status, uptime]);

  const recentNews = useMemo(
    () => [...NEWS_ITEMS].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4),
    [],
  );

  useEffect(() => {
    if (recentNews.length <= 1) return;
    if (isRailPaused) return;

    const id = window.setTimeout(() => {
      setRailAnim('swipe-left');
      setRailIndex((value) => (value + 1) % recentNews.length);
    }, NEWS_ROTATE_MS);

    return () => window.clearTimeout(id);
  }, [recentNews.length, railIndex, railResetToken, isRailPaused]);

  useEffect(() => {
    const preload = recentNews.map((item) => {
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
  }, [recentNews]);

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

  return (
    <>
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

      <header className="hero container reveal in-view" id="home-content">
        <div className="hero-grid">
          <div>
            <p className="eyebrow">Made by DNDGroup</p>
            <h2 className="home-typing-headline" data-typing-list="SurvivalKendy Minecraft Server|War or Peace Situations|Creativity, Strategy, Community.">{typingValue}</h2>
            <p className="subtitle">&quot;A server where creativity and strategy matter&quot;</p>
            {error ? <p className="meta">{error}</p> : null}
            <div className="button-group">
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
                className="ip-copy-box"
                onClick={(e) => {
                  navigator.clipboard.writeText('play.survivalkendy.systems');
                  const target = e.currentTarget;
                  target.classList.add('copied');
                  setTimeout(() => target.classList.remove('copied'), 2000);
                }}
                title="Click to copy IP"
                role="button"
                tabIndex={0}
              >
                <div className="ip-text-wrap">
                  <span className="ip-text">play.survivalkendy.systems</span>
                </div>
                <span className="ip-copy-indicator" aria-hidden="true">
                  <Copy size={16} className="icon-copy" />
                  <Check size={16} className="icon-check" />
                </span>
              </div>
              <p className="home-server-card-ip-note">No whitelist required. Copy the IP address and hop right in!</p>
            </div>
          </Card>
        </div>

        <div className="stats-grid home-redesign-stats" id="home-live-stats">
          {cards.map((card, index) => (
            <Card
              key={card.label}
              className="stat-box shadcn-card-lift"
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
          ))}
        </div>
      </header>

      <section className="container reveal in-view section">
        <p className="home-section-eyebrow">Why SurvivalKendy</p>
        <h2>What Makes Us Different</h2>
        <div className="home-features-bento">
          <Card className="home-features-card home-features-card--accent shadcn-card-lift">
            <span className="home-features-icon" aria-hidden="true">🛠️</span>
            <h3>Experienced Ownership</h3>
            <p>Run by operators with deep experience managing and maintaining Minecraft servers — so your sessions stay smooth.</p>
          </Card>
          <Card className="home-features-card shadcn-card-lift">
            <span className="home-features-icon" aria-hidden="true">📰</span>
            <h3>Community-Driven News</h3>
            <p>In-server events are documented as they unfold — wars, alliances, betrayals, all written by the community.</p>
          </Card>
          <Card className="home-features-card home-features-card--wide shadcn-card-lift">
            <span className="home-features-icon" aria-hidden="true">⚡</span>
            <h3>Professional Infrastructure</h3>
            <p className="home-features-card-lead">Hosted on dedicated cloud hardware with live monitoring on every page.</p>
            <ul className="home-features-specs">
              <li><strong>~15 ms</strong><span>avg ping</span></li>
              <li><strong>19 TPS</strong><span>steady tick rate</span></li>
              <li><strong>4 vCPU</strong><span>DigitalOcean C4D</span></li>
              <li><strong>8 GB</strong><span>DDR4 @ 2933 MHz</span></li>
              <li><strong>80 GB</strong><span>NVMe SSD storage</span></li>
              <li><strong>30</strong><span>player capacity</span></li>
            </ul>
          </Card>
          <Card className="home-features-card shadcn-card-lift">
            <span className="home-features-icon" aria-hidden="true">🌏</span>
            <h3>Diverse Community</h3>
            <p>Gender-inclusive, talent-rich, with a wide mix of teams rooted in a school-based social network.</p>
          </Card>
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
