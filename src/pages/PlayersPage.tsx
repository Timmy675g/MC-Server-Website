import { useState } from 'react';
import { usePollingStatus } from '../hooks/usePollingStatus';
import { MotionReveal } from '../components/MotionReveal';

type Player = {
  username?: string;
  fullName?: string;
  uuid?: string;
  headUrl?: string;
};

type PlayersResponse = {
  status?: string;
  source?: string;
  playersOnline?: number;
  playersMax?: number;
  players?: Player[];
};

function pseudonymizeUuid(value: string | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return 'Unavailable';

  let hash = 5381;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) + hash) + raw.charCodeAt(i);
    hash |= 0;
  }

  const token = Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
  return `anon-${token}`;
}

function avatarChain(player: Player): string[] {
  const username = String(player.username || '').trim();
  const uuid = String(player.uuid || '').trim();
  const chain: string[] = [];

  if (username) {
    chain.push(`https://minotar.net/helm/${encodeURIComponent(username)}/96`);
    chain.push(`https://mc-heads.net/avatar/${encodeURIComponent(username)}/96`);
  }

  if (uuid) {
    chain.push(`https://crafatar.com/avatars/${encodeURIComponent(uuid)}?size=96&overlay`);
  }

  chain.push('https://minotar.net/helm/Steve/96');
  return Array.from(new Set(chain));
}

export default function PlayersPage() {
  const {
    status,
    isLoading: isStatusLoading,
    isError: isStatusError,
    isStale: isStatusStale,
    lastUpdatedLabel,
    lastError,
  } = usePollingStatus();

  const players = Array.isArray(status?.players) ? status.players : [];
  const payload: PlayersResponse = {
    status: status?.status,
    source: status?.source,
    playersOnline: status?.playersOnline,
    playersMax: status?.playersMax,
    players,
  };

  return (
    <section className="container reveal in-view section">
      <article className="card" style={{ gridColumn: '1 / -1', marginBottom: '1rem' }}>
        <h1>Players</h1>
        <p className="subtitle">
          {payload?.status === 'online'
            ? `Server online: ${payload?.playersOnline ?? 0} / ${payload?.playersMax ?? 0}`
            : 'Server archived. Live player data is no longer available.'}
        </p>
        <div className={`live-status-strip ${isStatusStale ? 'is-stale' : ''} ${isStatusError ? 'is-error' : ''}`} role="status" aria-live="polite">
          <span className="live-status-dot" aria-hidden="true" />
          <strong>{payload?.source === 'Archive Mode' ? 'Archived' : isStatusLoading && !status ? 'Loading' : isStatusStale ? 'Stale' : 'Live'}</strong>
          <span>Last updated {lastUpdatedLabel}</span>
          {isStatusError ? <span>{lastError || 'Unable to fetch players right now.'}</span> : null}
        </div>
        <p className="meta">Source: {payload?.source ?? '--'}</p>
      </article>

      {players.length === 0 ? (
        <MotionReveal>
          <article className={`card players-empty polished-empty-state ${isStatusError ? 'is-error-card' : ''}`.trim()}>
            <strong>{payload?.source === 'Archive Mode' ? 'Player list archived' : isStatusLoading && !status ? 'Loading player names' : 'No player names available'}</strong>
            <p className="meta">
              {payload?.source === 'Archive Mode'
                ? 'The live backend is no longer running, so player names are not fetched on the static site.'
                : isStatusLoading && !status
                ? 'Waiting for the live Minecraft status sample.'
                : isStatusError
                  ? lastError || 'Unable to refresh player data right now.'
                  : 'The server is online, but the current status sample is not exposing player names.'}
            </p>
          </article>
        </MotionReveal>
      ) : (
        <div className="card-grid players-grid">
          {players.map((player, index) => {
            const username = String(player.username || player.fullName || 'Unknown');
            const [first, ...fallback] = avatarChain(player);

            return (
              <MotionReveal key={`${username}-${index}`} className="player-motion-card" delay={index * 0.035}>
                <PlayerCard
                  username={username}
                  uuid={pseudonymizeUuid(player.uuid)}
                  firstAvatar={first}
                  fallbackChain={fallback}
                />
              </MotionReveal>
            );
          })}
        </div>
      )}
    </section>
  );
}

type PlayerCardProps = {
  username: string;
  uuid: string;
  firstAvatar: string;
  fallbackChain: string[];
};

function PlayerCard({ username, uuid, firstAvatar, fallbackChain }: PlayerCardProps) {
  const [avatar, setAvatar] = useState(firstAvatar);
  const [attempt, setAttempt] = useState(0);

  return (
    <article className="card player-card">
      <img
        src={avatar}
        alt={`${username} avatar`}
        width={72}
        height={72}
        loading="lazy"
        decoding="async"
        className="player-head"
        onError={() => {
          if (attempt >= fallbackChain.length) return;
          setAvatar(fallbackChain[attempt]);
          setAttempt((value) => value + 1);
        }}
      />
      <div>
        <h3>{username}</h3>
        <p className="meta">UUID: {uuid}</p>
      </div>
    </article>
  );
}
