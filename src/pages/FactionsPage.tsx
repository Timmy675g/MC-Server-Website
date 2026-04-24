import { useMemo, useState } from 'react';
import { CURRENT_FACTION_ITEMS, PREVIOUS_FACTION_ITEMS } from '../lib/content';
import { assetUrl } from '../lib/asset-url';

export default function FactionsPage() {
  const [serverView, setServerView] = useState<'current' | 'previous'>('current');

  const visibleFactions = useMemo(
    () => (serverView === 'current' ? CURRENT_FACTION_ITEMS : PREVIOUS_FACTION_ITEMS),
    [serverView],
  );

  return (
    <main className="container section stack reveal in-view">
      <h1>Factions</h1>
      <p className="subtitle">You will see what factions did every 1.000 Blocks in this world...</p>

      <div className="button-group" role="group" aria-label="Faction server selector">
        <button
          type="button"
          className={`btn ${serverView === 'current' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setServerView('current')}
        >
          Current Server
        </button>
        <button
          type="button"
          className={`btn ${serverView === 'previous' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setServerView('previous')}
        >
          Previous Server
        </button>
      </div>

      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <h3>{serverView === 'current' ? 'Current Spawn Map' : 'Previous Server Spawn Map'}</h3>
        <img
          className="news-thumb faction-map-image"
          src={assetUrl('/assets/factions.png')}
          alt="Territory map"
          loading="lazy"
          decoding="async"
        />
      </div>

      <div id="faction-grid" className="card-grid">
        {visibleFactions.length === 0 ? (
          <article className="card" style={{ gridColumn: '1 / -1' }}>
            <h3>No factions recorded</h3>
            <p className="meta">Current server factions are currently set to 0.</p>
          </article>
        ) : visibleFactions.map((faction) => (
          <article key={faction.name} className="card">
            <h3>{faction.name}</h3>
            <p>{faction.description}</p>
            <p className="meta">Leader: {faction.leader}</p>
            <p className="meta">Members: {faction.members}</p>
            <p><strong>Territory:</strong> {faction.territory}</p>
            <p><strong>Allegiances:</strong> {faction.allegiances}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
