import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoadingScreen } from './components/LoadingScreen';
import { SiteLayout } from './layouts/SiteLayout';
import { prefetchApiInBackground, warmHomeCritical } from './lib/api';
import { assetUrl } from './lib/asset-url';
import { NEWS_ITEMS } from './lib/content';

const HomePage = lazy(() => import('./pages/HomePage'));
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

const MIN_BOOT_MS = 900;
const ROUTE_FALLBACK_PROGRESS = 96;
type BootChecks = {
  api: boolean;
  chunks: boolean;
  assets: boolean;
  paint: boolean;
};

const INITIAL_BOOT_CHECKS: BootChecks = {
  api: false,
  chunks: false,
  assets: false,
  paint: false,
};

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
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
  const [bootProgress, setBootProgress] = useState(8);
  const [checks, setChecks] = useState<BootChecks>(INITIAL_BOOT_CHECKS);

  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;

    const updateProgress = (next: BootChecks) => {
      if (!mounted) return;
      const doneCount = Object.values(next).filter(Boolean).length;
      const total = Object.keys(next).length;
      const pct = 8 + Math.round((doneCount / total) * 92);
      setChecks(next);
      setBootProgress(pct);
    };

    const runBoot = async () => {
      await Promise.allSettled([
        warmHomeCritical(),
        delay(MIN_BOOT_MS),
      ]);
      updateProgress({ api: true, chunks: false, assets: false, paint: false });

      await preloadRoutes();
      updateProgress({ api: true, chunks: true, assets: false, paint: false });

      await preloadCriticalAssets();
      updateProgress({ api: true, chunks: true, assets: true, paint: false });

      await waitForNextPaint();
      updateProgress({ api: true, chunks: true, assets: true, paint: true });

      if (!mounted) return;
      setBootProgress(100);
      setBooting(false);
      prefetchApiInBackground();
      prefetchRoutes();
    };

    void runBoot();

    return () => {
      mounted = false;
    };
  }, []);

  const bootChecks = [
    { label: 'Warm status API', done: checks.api },
    { label: 'Prepare page chunks', done: checks.chunks },
    { label: 'Load visual assets', done: checks.assets },
    { label: 'Finalize first paint', done: checks.paint },
  ];

  if (booting) {
    return <LoadingScreen progress={bootProgress} checks={bootChecks} />;
  }

  return (
    <Suspense
      fallback={
        <LoadingScreen
          title="Loading page"
          subtitle="Preparing route chunk and fresh content..."
          progress={ROUTE_FALLBACK_PROGRESS}
          checks={[
            { label: 'Warm status API', done: true },
            { label: 'Prepare page chunks', done: true },
            { label: 'Load visual assets', done: true },
            { label: 'Finalize first paint', done: false },
          ]}
        />
      }
    >
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/join" element={<GuidePage />} />
          <Route path="/apply" element={<ApplyPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/news/:id" element={<NewsArticlePage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/uptime" element={<UptimePage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/factions" element={<FactionsPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
