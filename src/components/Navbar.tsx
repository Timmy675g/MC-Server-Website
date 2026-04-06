import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { applyTheme, getInitialTheme } from '../lib/theme';
import { apiUrl } from '../lib/api-base';
import { unwrapPayload } from '../lib/api-envelope';
import type { ServerStatus } from '../types/api';

const infoItems = [
  { to: '/about', label: 'About' },
  { to: '/events', label: 'Events' },
  { to: '/factions', label: 'Factions' },
  { to: '/rules', label: 'Rules' },
];

const statusItems = [
  { to: '/players', label: 'Players' },
  { to: '/stats', label: 'Stats' },
  { to: '/uptime', label: 'Uptime' },
];

const mobileCollapsedItems = [...infoItems, ...statusItems];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'info' | 'status' | null>(null);
  const [hoverLockCount, setHoverLockCount] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => getInitialTheme());
  const [isTogglingTheme, setIsTogglingTheme] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [liveStatus, setLiveStatus] = useState<ServerStatus | null>(null);
  const location = useLocation();
  const statsBlocked = openDropdown !== null || hoverLockCount > 0;

  const isInfoActive = infoItems.some((item) => location.pathname === item.to);
  const isStatusActive = statusItems.some((item) => location.pathname === item.to);

  useEffect(() => {
    document.body.classList.toggle('nav-open-mobile', open);
    return () => document.body.classList.remove('nav-open-mobile');
  }, [open]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.nav-dropdown')) return;
      if (target.closest('.nav-stats')) return;
      setOpenDropdown(null);
      setStatsOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    let mounted = true;
    let inFlight = false;

    const pullStatus = async () => {
      if (inFlight) return;
      if (typeof document !== 'undefined' && document.hidden) return;

      inFlight = true;
      try {
        const response = await fetch(apiUrl('/status'), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });

        if (!response.ok) return;
        const raw = await response.json();
        const data = unwrapPayload<ServerStatus>(raw);
        if (!mounted) return;

        setLiveStatus({
          status: String(data?.status ?? 'offline'),
          playersOnline: Number(data?.playersOnline ?? 0),
          playersMax: Number(data?.playersMax ?? 0),
          uptime: Number(data?.uptime ?? 0),
          javaPing: Number.isFinite(Number(data?.javaPing)) ? Number(data.javaPing) : null,
          bedrockPing: Number.isFinite(Number(data?.bedrockPing)) ? Number(data.bedrockPing) : null,
          version: data?.version,
          software: data?.software,
        });
      } catch {
        // Ignore transient pull failures in navbar stats.
      } finally {
        inFlight = false;
      }
    };

    void pullStatus();
    const id = window.setInterval(() => {
      void pullStatus();
    }, 60000);

    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, []);

  const toggleTheme = () => {
    setIsTogglingTheme(true);
    window.setTimeout(() => setIsTogglingTheme(false), 360);
    setTheme((value) => (value === 'dark' ? 'light' : 'dark'));
  };

  const javaPingText = liveStatus?.javaPing !== null && liveStatus?.javaPing !== undefined
    ? `${Math.round(liveStatus.javaPing)} ms`
    : '--';
  const bedrockPingText = liveStatus?.bedrockPing !== null && liveStatus?.bedrockPing !== undefined
    ? `${Math.round(liveStatus.bedrockPing)} ms`
    : '--';
  const playerCountText = liveStatus
    ? `${liveStatus.playersOnline} / ${liveStatus.playersMax}`
    : '-- / --';

  const onDropdownMouseEnter = () => {
    setHoverLockCount((value) => value + 1);
  };

  const onDropdownMouseLeave = () => {
    setHoverLockCount((value) => Math.max(0, value - 1));
  };

  return (
    <nav className={`navbar ${statsOpen ? 'has-nav-stats' : ''}`} role="navigation" aria-label="Main navigation">
      <NavLink to="/" className="logo" aria-label="SurvivalKendy">
        <span className="brand-survival">Survival</span>
        <span className="brand-kendy">Kendy</span>
      </NavLink>

      <button
        type="button"
        className={`theme-toggle-btn ${isTogglingTheme ? 'is-toggling' : ''}`}
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? 'LIGHT MODE' : 'DARK MODE'}
      </button>

      <button
        type="button"
        className="mobile-menu-btn"
        onClick={() => setOpen((value) => !value)}
        aria-label="Toggle navigation"
        aria-expanded={open}
        aria-controls="nav-links"
      >
        ☰
      </button>

      <div id="nav-links" className={`nav-links ${open ? 'open' : ''}`}>
        <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')}>Home</NavLink>

        <div
          className={`nav-dropdown ${openDropdown === 'info' ? 'open' : ''}`}
          onMouseEnter={onDropdownMouseEnter}
          onMouseLeave={onDropdownMouseLeave}
        >
          <button
            type="button"
            className={`nav-dropdown-btn ${isInfoActive ? 'active' : ''}`}
            onClick={() => setOpenDropdown((value) => (value === 'info' ? null : 'info'))}
            aria-expanded={openDropdown === 'info'}
          >
            Information ▼
          </button>
          <div className="nav-dropdown-menu">
            {infoItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>

        <div
          className={`nav-dropdown ${openDropdown === 'status' ? 'open' : ''}`}
          onMouseEnter={onDropdownMouseEnter}
          onMouseLeave={onDropdownMouseLeave}
        >
          <button
            type="button"
            className={`nav-dropdown-btn ${isStatusActive ? 'active' : ''}`}
            onClick={() => setOpenDropdown((value) => (value === 'status' ? null : 'status'))}
            aria-expanded={openDropdown === 'status'}
          >
            Server Status ▼
          </button>
          <div className="nav-dropdown-menu">
            {statusItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>

        {mobileCollapsedItems.map((item) => (
          <NavLink key={`mobile-${item.to}`} to={item.to} className={({ isActive }) => (isActive ? 'active nav-collapse-target' : 'nav-collapse-target')}>
            {item.label}
          </NavLink>
        ))}

        <NavLink to="/news" className={({ isActive }) => (isActive ? 'active' : '')}>News</NavLink>
        <NavLink to="/join" className={({ isActive }) => (isActive ? 'active' : '')}>Guide</NavLink>
        <NavLink to="/apply" className={({ isActive }) => (isActive ? 'active nav-join-apply-link' : 'nav-join-apply-link')}>Apply</NavLink>
      </div>

      <div className={`nav-stats ${statsOpen && !statsBlocked ? 'open' : ''} ${statsBlocked ? 'is-disabled' : ''}`}>
        <button
          type="button"
          className="nav-stats-btn"
          aria-label="Toggle live stats"
          aria-expanded={statsOpen && !statsBlocked}
          disabled={statsBlocked}
          onClick={() => setStatsOpen((value) => !value)}
        >
          <span>▲</span>
        </button>
        <div className="nav-stats-panel" role="region" aria-label="Live server stats">
          <div className="nav-stats-grid">
            <div className="nav-stats-item">
              <span className="nav-stats-label">JAVA PING</span>
              <strong className="nav-stats-value">{javaPingText}</strong>
            </div>
            <div className="nav-stats-item">
              <span className="nav-stats-label">BEDROCK PING</span>
              <strong className="nav-stats-value">{bedrockPingText}</strong>
            </div>
            <div className="nav-stats-item">
              <span className="nav-stats-label">PLAYER COUNT</span>
              <strong className="nav-stats-value">{playerCountText}</strong>
            </div>
          </div>
          <p className="nav-stats-note">Live probe via mcstatus.io with local API cache.</p>
        </div>
      </div>
    </nav>
  );
}
