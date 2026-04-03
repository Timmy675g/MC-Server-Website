export default function EventsPage() {
  return (
    <main className="container section stack reveal in-view">
      <h1>Events</h1>
      <section>
        <h2>Timeline:</h2>
        <div className="timeline">
          <article className="card">
            <h3>Grace Period</h3>
            <p className="meta">Phase 1</p>
            <p>Building, planning, diplomacy, and economy focus. No active war declaration.</p>
          </article>
          <article className="card">
            <h3>War</h3>
            <p className="meta">Phase 2</p>
            <p>Faction conflict window is active with full war mechanics enabled.</p>
          </article>
          <article className="card">
            <h3>Grace Period</h3>
            <p className="meta">Phase 3</p>
            <p>Cooldown cycle for reconstruction, negotiation, and civilian recovery.</p>
          </article>
          <article className="card">
            <h3>Freedom</h3>
            <p className="meta">Phase 4</p>
            <p>
              Current server state is FREEDOM. Players are free to do whatever they want under Admin and Anticheat
              watch!
            </p>
          </article>
          <article className="card">
            <h3>Current: Reset</h3>
            <p className="meta">Active Phase</p>
            <p>
              Due to many players being bored, The server owner has decided to reset the server with more content
              whilst still have Freedom.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
