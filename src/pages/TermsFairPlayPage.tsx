import { Ban, Eye, Shield } from 'lucide-react';

export default function TermsFairPlayPage() {
  return (
    <main className="container section stack reveal in-view terms-fair-play-page">
      <h1>Terms of Service and Fair Play</h1>
      <p className="subtitle">Focus: Security, Anti-Cheat, and Community Standards.</p>

      <article id="anti-cheat" className="card">
        <h3>Anti-Cheat Policy</h3>
        <p>
          The server applies layered server-side detection and Anti-Hack protocols to protect fair gameplay.
          Zero tolerance is enforced for X-Ray clients, fly-hacks, combat scripts, auto-clickers, or other
          unauthorized automation that creates unfair advantage.
        </p>
      </article>

      <article id="privacy" className="card">
        <h3>Privacy and Telemetry</h3>
        <p>
          Connection metadata such as IP and UUID are logged for security monitoring, incident response,
          and prevention of alt-account abuse. Telemetry is limited to operational integrity and fair-play
          enforcement.
        </p>
      </article>

      <article id="agreement" className="card stack">
        <h3>Rules of Engagement</h3>
        <p className="meta">Acknowledgment of protocol requirements.</p>

        <ul className="stack terms-rules-list">
          <li className="terms-rule-item">
            <Shield className="terms-engagement-icon" aria-hidden="true" />
            <div>
              <strong>Security First</strong>
              <p className="meta">Follow authentication and verification procedures. Report suspicious behavior immediately.</p>
            </div>
          </li>
          <li className="terms-rule-item">
            <Ban className="terms-engagement-icon" aria-hidden="true" />
            <div>
              <strong>No Exploit Use</strong>
              <p className="meta">Do not use exploit tools, hacked clients, or evasion techniques. Violations trigger strict penalties.</p>
            </div>
          </li>
          <li className="terms-rule-item">
            <Eye className="terms-engagement-icon" aria-hidden="true" />
            <div>
              <strong>Transparent Conduct</strong>
              <p className="meta">Respect moderators and community standards. Keep interactions visible, fair, and accountable.</p>
            </div>
          </li>
        </ul>
      </article>
    </main>
  );
}