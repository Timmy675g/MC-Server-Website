import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { getAuthProvider, isAdminAuthenticated } from '../lib/auth';

type LoginLocationState = {
  from?: {
    pathname?: string;
  };
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LoginLocationState | null;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) return;
    navigate('/admin', { replace: true });
  }, [navigate]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await getAuthProvider().login({ username, password });
      if (!result.ok) {
        setError(result.message || 'Unable to login.');
        return;
      }

      const fallbackPath = '/admin';
      const nextPath = state?.from?.pathname || fallbackPath;
      navigate(nextPath === '/login' ? fallbackPath : nextPath, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container section stack reveal in-view">
      <Card className="card" style={{ gridColumn: '1 / -1', maxWidth: '560px', margin: '0 auto' }}>
        <h1>Admin Login</h1>
        <p className="subtitle" style={{ marginTop: '0.35rem' }}>
          Sign in to access maintenance controls and uptime administration.
        </p>

        <form onSubmit={onSubmit} className="stack" style={{ marginTop: '1rem', gap: '0.8rem' }}>
          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            type="text"
            className="input"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Admin"
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            className="input"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            required
          />

          {error ? <p style={{ color: 'var(--danger)' }}>{error}</p> : null}

          <div className="button-group" style={{ marginTop: '0.25rem' }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Signing in...' : 'Login'}
            </button>
          </div>
        </form>
      </Card>
    </main>
  );
}
