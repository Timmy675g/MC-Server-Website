import { lazy, Suspense, useEffect, useState, type ReactElement } from 'react';
import { useLocation } from 'react-router-dom';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoadingScreen } from './components/LoadingScreen';
import { SiteLayout } from './layouts/SiteLayout';
import { prefetchApiInBackground, warmHomeCritical } from './lib/api';
import { assetUrl } from './lib/asset-url';
import { NEWS_ITEMS } from './lib/content';
import { isAdminAuthenticated } from './lib/auth';
import HomePage from './pages/HomePage';

const GuidePage = lazy(() => import('./pages/GuidePage'));
const ApplyPage = lazy(() => import('./pages/ApplyPage'));
const NewsPage = lazy(() => import('./pages/NewsPage'));
const NewsArticlePage = lazy(() => import('./pages/NewsArticlePage'));
const PlayersPage = lazy(() => import('./pages/PlayersPage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const UptimePage = lazy(() => import('./pages/UptimePage'));
const FactionsPage = lazy(() => import('./pages/FactionsPage'));
const RulesPage = lazy(() => import('./pages/RulesPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

const MIN_BOOT_MS = 260;
// Ping-pong uses alternate direction, so one full left->right->left cycle is 2x duration.
const PING_PONG_FULL_CYCLE_MS = 2800;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
    task
      .then((value) => {
        window.clearTimeout(id);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(id);
        reject(error);
      });
  });
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function scheduleIdleTask(task: () => void, timeout = 1500) {
  const requestIdle = (window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  }).requestIdleCallback;

  if (requestIdle) {
    requestIdle(task, { timeout });
    return;
  }

  window.setTimeout(task, 280);
}

function isMobileConstrainedDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const narrowScreen = window.matchMedia('(max-width: 980px)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };

  const saveData = Boolean(nav.connection?.saveData);
  const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
  const lowCpu = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 6;

  return coarsePointer || narrowScreen || reduceMotion || saveData || lowMemory || lowCpu;
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
}

function preloadVideoMetadata(src: string): Promise<void> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      video.removeAttribute('src');
      video.load();
      resolve();
    };

    const timeoutId = window.setTimeout(finish, 2600);

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onloadeddata = () => {
      window.clearTimeout(timeoutId);
      finish();
    };
    video.oncanplay = () => {
      window.clearTimeout(timeoutId);
      finish();
    };
    video.onerror = () => {
      window.clearTimeout(timeoutId);
      finish();
    };
    video.src = src;
  });
}

async function preloadCriticalAssets() {
  const newsThumbs = NEWS_ITEMS.slice(0, 4).map((item) => preloadImage(assetUrl(item.thumbnail)));

  await Promise.allSettled([
    preloadImage(assetUrl('/assets/icon.png')),
    preloadVideoMetadata(assetUrl('/assets/Video.mp4')),
    ...newsThumbs,
  ]);
}

function preloadRoutes() {
  return Promise.allSettled([
    import('./pages/GuidePage'),
    import('./pages/ApplyPage'),
    import('./pages/NewsPage'),
    import('./pages/FactionsPage'),
    import('./pages/RulesPage'),
    import('./pages/AboutPage'),
    import('./pages/EventsPage'),
    import('./pages/PlayersPage'),
    import('./pages/StatsPage'),
    import('./pages/UptimePage'),
    import('./pages/NewsArticlePage'),
  ]);
}

function prefetchRoutes() {
  const requestIdle = (window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  }).requestIdleCallback;

  const run = () => {
    void preloadRoutes();
  };

  if (requestIdle) {
    requestIdle(run, { timeout: 1600 });
    return;
  }

  window.setTimeout(run, 500);
}

function App() {
  const [booting, setBooting] = useState(true);

  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    const applyPerformanceClasses = () => {
      const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const saveData = Boolean(nav.connection?.saveData);
      const lite = isMobileConstrainedDevice();

      document.body.classList.toggle('mobile-lite', lite);
      document.body.classList.toggle('data-saver', saveData || reduceMotion);
    };

    applyPerformanceClasses();
    window.addEventListener('resize', applyPerformanceClasses);

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onReducedMotionChange = () => applyPerformanceClasses();
    reducedMotionQuery.addEventListener('change', onReducedMotionChange);

    return () => {
      window.removeEventListener('resize', applyPerformanceClasses);
      reducedMotionQuery.removeEventListener('change', onReducedMotionChange);
      document.body.classList.remove('mobile-lite', 'data-saver');
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const constrainedDevice = isMobileConstrainedDevice();

    const runBoot = async () => {
      const bootStartedAt = performance.now();

      // Block initial boot on truly critical dependencies so we do not show a blank
      // page after loader dismissal on slower networks.
      await Promise.allSettled([
        withTimeout(warmHomeCritical(), constrainedDevice ? 5200 : 3600),
        delay(constrainedDevice ? 140 : MIN_BOOT_MS),
      ]);

      // Keep non-critical work deferred to idle after critical readiness.
      scheduleIdleTask(() => {
        void preloadRoutes();
      }, constrainedDevice ? 2200 : 1200);

      scheduleIdleTask(() => {
        void preloadCriticalAssets();
      }, constrainedDevice ? 3200 : 1800);

      await waitForNextPaint();

      const elapsedMs = performance.now() - bootStartedAt;
      if (elapsedMs < PING_PONG_FULL_CYCLE_MS) {
        await delay(PING_PONG_FULL_CYCLE_MS - elapsedMs);
      }

      if (!mounted) return;
      setBooting(false);

      scheduleIdleTask(() => {
        prefetchApiInBackground();
      }, 1000);

      scheduleIdleTask(() => {
        prefetchRoutes();
      }, constrainedDevice ? 2800 : 1800);
    };

    void runBoot();

    return () => {
      mounted = false;
    };
  }, []);

  if (booting) {
    return <LoadingScreen />;
  }

  const requireAdmin = (element: ReactElement) => (
    isAdminAuthenticated() ? element : <Navigate to="/login" replace />
  );

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/join" element={<GuidePage />} />
          <Route path="/apply" element={<ApplyPage />} />
          <Route path="/index" element={<ApplyPage />} />
          <Route path="/index.html" element={<ApplyPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/news/:id" element={<NewsArticlePage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/uptime" element={<UptimePage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/factions" element={<FactionsPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={requireAdmin(<AdminPage />)} />
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
