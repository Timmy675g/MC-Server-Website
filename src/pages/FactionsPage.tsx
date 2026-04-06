import { FACTION_ITEMS } from '../lib/content';
import { assetUrl } from '../lib/asset-url';

export default function FactionsPage() {
  return (
    <main className="container section stack reveal in-view">
      <h1>Factions</h1>
      <p className="subtitle">You will see what factions did every 1.000 Blocks in this world...</p>

      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <h3>Current Spawn Map</h3>
        <img
          className="news-thumb faction-map-image"
          src={assetUrl('/assets/factions.png')}
          alt="Territory map"
          loading="lazy"
          decoding="async"
        />
      </div>

      <div id="faction-grid" className="card-grid">
        {FACTION_ITEMS.map((faction) => (
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
