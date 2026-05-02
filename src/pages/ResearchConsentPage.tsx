import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { Button } from '../components/ui/button';
import { assetUrl } from '../lib/asset-url';

type PdfSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

const PDF_SECTIONS: PdfSection[] = [
  {
    title: 'Introduction',
    paragraphs: [
      'This study focuses on Minecraft gameplay and its effect on student friendships and collaboration.',
      'Participants will continue their usual activity while researchers examine social interaction patterns, team coordination, and peer support behaviors in a natural multiplayer environment.',
    ],
  },
  {
    title: 'Participation Details',
    bullets: [
      'Participation happens through natural gameplay with no special scripted tasks required.',
      'Two optional surveys may be offered, each taking about 10 minutes.',
      'Some participants may be invited to a brief optional interview.',
    ],
  },
  {
    title: 'Data Collection',
    bullets: [
      'Gameplay logs and interaction traces.',
      'Chat pattern analysis and collaborative communication markers.',
      'Optional survey responses and interview notes.',
    ],
    paragraphs: [
      'All collected data will be anonymized before analysis and publication.',
    ],
  },
  {
    title: 'Participant Rights',
    bullets: [
      'Participation is fully voluntary.',
      'You can withdraw at any time without penalty.',
      'Your decision to participate does not affect your school grades.',
    ],
  },
];

async function loadImageAsDataUrl(src: string): Promise<string | null> {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;

    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const value = typeof reader.result === 'string' ? reader.result : '';
        if (value) resolve(value);
        else reject(new Error('Image conversion failed'));
      };
      reader.onerror = () => reject(new Error('Image read failed'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function ResearchConsentPage() {
  const navigate = useNavigate();
  const [hasReachedBottom, setHasReachedBottom] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const thresholdPx = 18;
      const nearBottom = window.scrollY + window.innerHeight >= doc.scrollHeight - thresholdPx;
      if (nearBottom) setHasReachedBottom(true);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const downloadPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 44;
    const contentWidth = pageWidth - margin * 2;

    try {
      doc.setFillColor(8, 21, 45);
      doc.rect(0, 0, pageWidth, 108, 'F');

      const logo = await loadImageAsDataUrl(assetUrl('/assets/icon.png'));
      if (logo) {
        doc.addImage(logo, 'PNG', margin, 26, 42, 42, undefined, 'FAST');
      }

      doc.setTextColor(232, 240, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('SurvivalKendy Research Document', margin + 54, 46);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text('Informed Consent for Research Participation', margin + 54, 64);
      doc.text('Project: Virtual Collaboration as a Catalyst for Prosocial Development', margin + 54, 80);

      let y = 132;
      const ensureSpace = (requiredHeight: number) => {
        if (y + requiredHeight <= pageHeight - margin) return;
        doc.addPage();
        y = margin;
      };

      doc.setTextColor(20, 28, 38);

      for (const section of PDF_SECTIONS) {
        ensureSpace(70);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(24, 74, 179);
        doc.text(section.title, margin, y);
        y += 20;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);

        if (section.paragraphs) {
          for (const paragraph of section.paragraphs) {
            const lines = doc.splitTextToSize(paragraph, contentWidth);
            ensureSpace(lines.length * 14 + 10);
            doc.text(lines, margin, y);
            y += lines.length * 14 + 8;
          }
        }

        if (section.bullets) {
          for (const bullet of section.bullets) {
            const lines = doc.splitTextToSize(`- ${bullet}`, contentWidth - 12);
            ensureSpace(lines.length * 14 + 8);
            doc.text(lines, margin + 10, y);
            y += lines.length * 14 + 6;
          }
        }

        y += 6;
      }

      const pageCount = doc.getNumberOfPages();
      const dateText = new Date().toLocaleDateString();

      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(93, 108, 132);
        doc.text(`SurvivalKendy Research Team | Generated ${dateText}`, margin, pageHeight - 16);
        doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 16, { align: 'right' });
      }

      doc.save('survivalkendy-informed-consent.pdf');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <main className="container section stack reveal in-view research-consent-page">
      <h1>Informed Consent for Research Participation</h1>
      <p className="subtitle">Project: Virtual Collaboration as a Catalyst for Prosocial Development</p>

      <section className="consent-scroll-panel consent-grid" aria-label="Research consent content">
        <article className="card">
          <h3>Introduction</h3>
          <p className="meta consent-intro-meta" style={{ marginBottom: '0.6rem' }}>
            This study focuses on Minecraft gameplay and its effect on student friendships and collaboration.
          </p>
          <p className="consent-body-text">
            Participants will continue their usual activity while researchers examine social interaction patterns,
            team coordination, and peer support behaviors in a natural multiplayer environment.
          </p>
        </article>

        <article className="card">
          <h3>Participation Details</h3>
          <ul className="consent-list">
            <li>Participation happens through natural gameplay with no special scripted tasks required.</li>
            <li>Two optional surveys may be offered, each taking about 10 minutes.</li>
            <li>Some participants may be invited to a brief optional interview.</li>
          </ul>
        </article>

        <article className="card">
          <h3>Data Collection</h3>
          <ul className="consent-list">
            <li>Gameplay logs and interaction traces.</li>
            <li>Chat pattern analysis and collaborative communication markers.</li>
            <li>Optional survey responses and interview notes.</li>
          </ul>
          <p className="meta" style={{ marginTop: '0.65rem' }}>
            All collected data will be anonymized before analysis and publication.
          </p>
        </article>

        <article className="card">
          <h3>Participant Rights</h3>
          <ul className="consent-list">
            <li>Participation is fully voluntary.</li>
            <li>You can withdraw at any time without penalty.</li>
          </ul>
        </article>
      </section>

      <article className="card consent-actions">
        <Button type="button" variant="outline" onClick={() => { void downloadPdf(); }} disabled={pdfBusy}>
          {pdfBusy ? 'Generating PDF...' : 'Download PDF'}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => navigate('/')}
          disabled={!hasReachedBottom}
        >
          I Agree, Return Home
        </Button>
        <p className="meta">Scroll to the end of this document to enable agreement.</p>
      </article>
    </main>
  );
}