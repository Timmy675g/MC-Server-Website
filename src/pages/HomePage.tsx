import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { getStatus, getUptime } from '../lib/api';
import { FACTION_ITEMS, NEWS_ITEMS, formatDate } from '../lib/content';
import type { ServerStatus, UptimeStats } from '../types/api';

const NEWS_ROTATE_MS = 6200;

function statusTone(status: string): string {
  if (status === 'online') return 'status-online';
  if (status === 'degraded') return 'status-pinging';
  return 'status-offline';
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
  const [typingValue, setTypingValue] = useState(typingWords[0]);
  const [railIndex, setRailIndex] = useState(0);
  const [railResetToken, setRailResetToken] = useState(0);
  const [isRailPaused, setIsRailPaused] = useState(false);
  const [railAnim, setRailAnim] = useState<'swipe-left' | 'swipe-right'>('swipe-left');
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

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
    const text = typingWords[typingIndex];
    let frame = 0;
    let deleting = false;

    const tick = () => {
      if (!deleting) {
        frame += 1;
        setTypingValue(text.slice(0, frame));
        if (frame >= text.length) {
          deleting = true;
          window.setTimeout(tick, 1100);
          return;
        }
      } else {
        frame -= 1;
        setTypingValue(text.slice(0, Math.max(frame, 0)));
        if (frame <= 0) {
          setTypingIndex((value) => (value + 1) % typingWords.length);
          return;
        }
      }

      window.setTimeout(tick, deleting ? 34 : 52);
    };

    const timer = window.setTimeout(tick, 220);
    return () => window.clearTimeout(timer);
  }, [typingIndex, typingWords]);

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
  }, []);

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
    const liveStatus = status?.status === 'online' ? 'Operational' : 'Down';
    return [
      {
        label: 'Status',
        value: liveStatus,
        className: statusTone(status?.status ?? ''),
      },
      {
        label: 'Current Players',
        value:
          status && Number.isFinite(status.playersOnline) && Number.isFinite(status.playersMax)
            ? `${status.playersOnline} / ${status.playersMax}`
            : '-- / --',
        className: '',
      },
      {
        label: 'Factions',
        value: `${FACTION_ITEMS.length}`,
        className: '',
      },
      {
        label: 'Uptime',
        value: uptime?.uptimePercent !== null && uptime?.uptimePercent !== undefined
          ? `${uptime.uptimePercent.toFixed(2)}%`
          : '--',
        className: 'uptime-good',
      },
      {
        label: 'Location',
        value: 'Jakarta, Indonesia',
        className: '',
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
      image.src = item.thumbnail;
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

  const registeredPlayers = 50;

  return (
    <>
      <section className="home-intro" aria-label="Intro video">
        <video className="home-intro-video" autoPlay muted loop playsInline preload="metadata" poster="/assets/icon.png">
          <source src="/assets/Video.mp4" type="video/mp4" />
        </video>
        <div className="home-intro-overlay" />
        <div className="home-intro-content container">
          <p className="home-intro-kicker">
            <span className="brand-survival">Survival</span><span className="brand-kendy">Kendy</span>{' '}
            <span className="brand-minecraft">Minecraft</span>{' '}
            <span className="brand-server">Server</span>
          </p>
          <h1>Where Strategy Shapes the World.</h1>
          <p>Build alliances, lead your faction, and create stories worth remembering.</p>
          <div className="button-group home-intro-actions">
            <Link to="/join" className="btn btn-primary">Enter Server</Link>
            <a href="#home-content" className="btn btn-outline">Explore Site</a>
          </div>
          <a className="home-intro-scroll" href="#home-content" aria-label="Scroll to content">
            <span />
            <strong className="intro-cue-desktop">SCROLL</strong>
            <strong className="intro-cue-mobile">SWIPE UP</strong>
          </a>
        </div>
      </section>

      <header className="hero container reveal in-view" id="home-content">
        <article className="card opening-timer-card">
          <p className="eyebrow">New Milestone!</p>
          <h2>The Server has reached the first Milestone of 50 Registered Players!</h2>
          <h4 className="opening-milestone-note">It is unbelieveable how the server can grow this fast!</h4>
          {error ? <p>{error}</p> : null}
        </article>

        <div className="hero-grid">
          <div>
            <p className="eyebrow">Made by DNDGroup</p>
            <h1 data-typing-list="SurvivalKendy Minecraft Server|War or Peace Situations|Creativity, Strategy, Community.">{typingValue}</h1>
            <p className="subtitle">&quot;A server where creativity and strategy matter&quot;</p>
            <div className="button-group">
              <Link to="/join" className="btn btn-primary">JOIN NOW</Link>
              <Link to="/news" className="btn btn-secondary">READ THE NEWS</Link>
              <Link to="/rules" className="btn btn-outline">VIEW RULES</Link>
            </div>
          </div>
          <div className="hero-image-card">
            <img src="/assets/icon.png" alt="Minecraft server icon" decoding="async" fetchPriority="high" />
            <p className="hero-caption">A picture of our server icon!</p>
          </div>
        </div>

        <div className="stats-grid" id="home-live-stats">
          {cards.map((card) => (
            <article key={card.label} className="stat-box">
              <span className="stat-label">{card.label}</span>
              <span className={`stat-value ${card.className}`}>{card.value}</span>
            </article>
          ))}
        </div>
      </header>

      <section className="container reveal in-view section">
        <h2>What Makes Us Different</h2>
        <div className="card-grid four-up">
          <article className="card feature-card">
            <h3>Experienced Owner And Maintainer</h3>
            <p>The owner has extensive experience in managing and maintaining Minecraft servers, ensuring a smooth and enjoyable experience for all players.</p>
          </article>
          <article className="card feature-card">
            <h3>Community-Driven News</h3>
            <p>Community-driven news coverage documenting server events as they unfold.</p>
          </article>
          <article className="card feature-card">
            <h3>Professional Infrastructure</h3>
            <ul>
              <li>Avg 15ms ping</li>
              <li>Avg 20 TPS</li>
              <li>Live uptime shown on Home, Stats, and Uptime pages</li>
              <li>GCP C4D with 4 vCPU</li>
              <li>16GB DDR5 RAM</li>
              <li>50 GB Hyperdisk</li>
            </ul>
          </article>
          <article className="card feature-card">
            <h3>Diverse Community</h3>
            <p>Gender inclusive, talent rich, lots of different teams and built from a school based social network.</p>
          </article>
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
                    className={`news-rail-tab ${index === railIndex ? 'is-active' : ''} ${index === railIndex && !isRailPaused ? 'is-running' : ''}`.trim()}
                    onClick={() => goToNewsIndex(index)}
                    aria-selected={index === railIndex ? 'true' : 'false'}
                  >
                    <span>{item.id}</span>
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
                <img className="news-rail-media" src={activeNews.thumbnail} alt={activeNews.title} loading="lazy" decoding="async" />
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
        <h2>Quick Stats</h2>
        <div className="card-grid four-up" id="quick-stats">
          <article className="card metric-card">
            <p>Online Players</p>
            <h3>{status?.playersOnline ?? '--'}</h3>
          </article>
          <article className="card metric-card">
            <p>Total Factions</p>
            <h3>{FACTION_ITEMS.length}</h3>
          </article>
          <article className="card metric-card">
            <p>Server Uptime</p>
            <h3>{uptime?.uptimePercent !== null && uptime?.uptimePercent !== undefined ? `${uptime.uptimePercent.toFixed(2)}%` : '--'}</h3>
          </article>
          <article className="card metric-card">
            <p>Total Registered Players</p>
            <h3>{registeredPlayers}</h3>
          </article>
        </div>
      </section>
    </>
  );
}
