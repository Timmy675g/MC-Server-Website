import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, Moon, Sun, Menu, X } from 'lucide-react';
import { applyTheme, getInitialTheme } from '../lib/theme';
import { usePollingStatus } from '../hooks/usePollingStatus';

const infoItems = [
  { to: '/about', label: 'About' },
  { to: '/events', label: 'Events' },
  { to: '/factions', label: 'Factions' },
  { to: '/rules', label: 'Rules' },
];

const statusItems = [
  { to: '/players', label: 'Players' },
  { to: '/stats', label: 'Stats' },
];

const mobileCollapsedItems = [...infoItems, { to: '/login', label: 'Login' }, ...statusItems];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'info' | 'status' | null>(null);
  const [hoverLockCount, setHoverLockCount] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => getInitialTheme());
  const [isTogglingTheme, setIsTogglingTheme] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const {
    status: liveStatus,
    isLoading: isStatusLoading,
    isError: isStatusError,
    isStale: isStatusStale,
    lastUpdatedLabel,
  } = usePollingStatus();
  const location = useLocation();
  const statsBlocked = openDropdown !== null || hoverLockCount > 0;

  const isInfoActive = infoItems.some((item) => location.pathname === item.to);
  const isStatusActive = statusItems.some((item) => location.pathname === item.to);

  useEffect(() => {
    document.body.classList.toggle('nav-open-mobile', open);
    return () => document.body.classList.remove('nav-open-mobile');
  }, [open]);

  // Auto-close the mobile menu and any open dropdowns on navigation.
  // Without this, body.nav-open-mobile (which sets overflow:hidden +
  // touch-action:none) can persist after route change, making the new
  // page un-scrollable / un-swipeable.
  useEffect(() => {
    setOpen(false);
    setOpenDropdown(null);
    setStatsOpen(false);
    setHoverLockCount(0);
    document.body.classList.remove('nav-open-mobile');
  }, [location.pathname]);

  // Final safety net: ensure the scroll-lock class is never left behind
  // if the Navbar somehow unmounts while open.
  useEffect(() => {
    return () => {
      document.body.classList.remove('nav-open-mobile');
    };
  }, []);

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
  const navLiveLabel = isStatusLoading && !liveStatus
    ? 'Loading'
    : isStatusStale || isStatusError
      ? 'Stale'
      : 'Live';

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

      <div className="nav-controls">
        <button
          type="button"
          className={`theme-toggle-btn ${isTogglingTheme ? 'is-toggling' : ''}`}
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18} strokeWidth={2.5} /> : <Moon size={18} strokeWidth={2.5} />}
        </button>

        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle navigation"
          aria-expanded={open}
          aria-controls="nav-links"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

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
            <span>Information</span>
            <ChevronDown className="nav-dropdown-chevron" size={16} aria-hidden="true" />
          </button>
          <div className="nav-dropdown-menu">
            {infoItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {item.label}
              </NavLink>
            ))}
            <NavLink to="/login" className={({ isActive }) => (isActive ? 'active' : '')}>
              Login
            </NavLink>
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
            <span>Server Status</span>
            <ChevronDown className="nav-dropdown-chevron" size={16} aria-hidden="true" />
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
        <NavLink to="/join" className={({ isActive }) => (isActive ? 'active' : '')}>Join</NavLink>
      </div>

      <div className={`nav-stats ${statsOpen && !statsBlocked ? 'open' : ''} ${statsBlocked ? 'is-disabled' : ''}`}>
        <button
          type="button"
          className="nav-stats-btn"
          aria-label="Toggle live stats panel"
          aria-expanded={statsOpen && !statsBlocked}
          disabled={statsBlocked}
          onClick={() => setStatsOpen((value) => !value)}
        >
          <span className="nav-stats-btn-icon">▲</span>
          <span className="nav-stats-btn-label">Live Stats</span>
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
          <p className={`nav-stats-note ${isStatusStale || isStatusError ? 'is-stale' : ''}`}>
            {navLiveLabel} · Last updated {lastUpdatedLabel}
          </p>
        </div>
      </div>
    </nav>
  );
}
