import { useEffect, useState } from 'react';
import { apiUrl } from '../lib/api-base';
import { unwrapPayload } from '../lib/api-envelope';

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
  const [payload, setPayload] = useState<PlayersResponse | null>(null);
  const [servers, setServers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch(apiUrl('/players'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Players request failed: ${response.status}`);
        return response.json() as Promise<{ payload?: PlayersResponse } | PlayersResponse>;
      })
      .then((raw) => {
        if (!mounted) return;
        const data = unwrapPayload<PlayersResponse>(raw);
        setPayload(data);
        setServers(Array.isArray(data?.players) ? data.players : []);
      })
      .catch(() => {
        if (!mounted) return;
        setError('Unable to fetch players right now.');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const players = servers;

  return (
    <section className="container reveal in-view section">
      <article className="card" style={{ gridColumn: '1 / -1', marginBottom: '1rem' }}>
        <h1>Players</h1>
        {error ? (
          <p>{error}</p>
        ) : (
          <>
            <p className="subtitle">
              {payload?.status === 'online'
                ? `Server online: ${payload?.playersOnline ?? 0} / ${payload?.playersMax ?? 0}`
                : `Server offline. Last known: ${payload?.playersOnline ?? 0} / ${payload?.playersMax ?? 0}`}
            </p>
            <p className="meta">Source: {payload?.source ?? '--'}</p>
          </>
        )}
      </article>

      {players.length === 0 ? (
        <article className="card players-empty">
          No player names are currently exposed by upstream API.
        </article>
      ) : (
        <div className="card-grid players-grid">
          {players.map((player, index) => {
            const username = String(player.username || player.fullName || 'Unknown');
            const [first, ...fallback] = avatarChain(player);

            return (
              <PlayerCard
                key={`${username}-${index}`}
                username={username}
                uuid={pseudonymizeUuid(player.uuid)}
                firstAvatar={first}
                fallbackChain={fallback}
              />
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
