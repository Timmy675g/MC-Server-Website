import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function GuidePage() {
  useEffect(() => {
    document.body.classList.add('join-page');
    return () => {
      document.body.classList.remove('join-page');
    };
  }, []);

  return (
    <main className="container section stack reveal in-view">
      <h1>How To Join</h1>

      <article className="card">
        <h3>Apply</h3>
        <p>Apply to our email to get whitelisted! Click the link down below to go to the apply page!</p>
        <p className="card-actions">
          <Link className="btn btn-secondary" to="/apply">Go To Application Form</Link>
        </p>
      </article>

      <section className="two-col">
        <article className="card">
          <h3>Minecraft Java Edition</h3>
          <p>All Java Version is currently supported but is highly recommended to play in the latest version!</p>
          <ol>
            <li>Open Minecraft.</li>
            <li>Click Multiplayer.</li>
            <li>Select Add Server.</li>
            <li>Enter server IP.</li>
            <li>Join and verify your AuthMe account using /register (password) (repeat_password).</li>
          </ol>
        </article>

        <article className="card">
          <h3>Minecraft Bedrock Edition</h3>
          <p>Bedrock versions are supported for the latest version!</p>
          <p>Use the same address and the active Bedrock port that is given!</p>
          <p>Register your AuthMe account using /register (password) (repeat_password)</p>
        </article>
      </section>

      <section className="two-col">
        <article className="card">
          <h3>First Time Player Guide</h3>
          <ol>
            <li>Read rules.</li>
            <li>Choose or make your own faction.</li>
            <li>Start building and communicating.</li>
            <li>Defend your territories!</li>
          </ol>
        </article>

        <article className="card">
          <h3>Rules Summary</h3>
          <p>Please respect everyone in the server! Read the rules to know more!</p>
          <p><Link className="link-arrow" to="/rules">Read full rules -&gt;</Link></p>
        </article>
      </section>
    </main>
  );
}
