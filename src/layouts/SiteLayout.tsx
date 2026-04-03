import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { Navbar } from '../components/Navbar';

export function SiteLayout() {
  useEffect(() => {
    const progressBar = document.getElementById('scroll-progress-bar');
    if (!progressBar) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const top = window.scrollY || doc.scrollTop || 0;
      const height = Math.max(doc.scrollHeight - window.innerHeight, 1);
      const ratio = Math.max(0, Math.min(1, top / height));

      progressBar.style.transform = `scaleX(${ratio})`;
      document.body.classList.toggle('is-scrolled', top > 8);
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    requestUpdate();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      document.body.classList.remove('is-scrolled');
    };
  }, []);

  return (
    <>
      <div className="bg-orb orb-a" />
      <div className="bg-orb orb-b" />
      <div id="scroll-progress-bar" className="scroll-progress" aria-hidden="true" />
      <Navbar />
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <p>© {new Date().getFullYear()} SurvivalKendy. Built for SurvivalKendy Minecraft Server.</p>
        <p>Credits: Website by <a href="https://example.com" target="_blank" rel="noreferrer">Developer Portfolio</a></p>
        <p>Owner Instagram : <a href="https://www.instagram.com/timmy675g/" target="_blank" rel="noreferrer">https://www.instagram.com/timmy675g/</a></p>
      </footer>
    </>
  );
}
