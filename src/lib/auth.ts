import { apiUrl } from './api-base';

const ADMIN_SESSION_KEY = 'sk-admin-session';
const ADMIN_LOGGED_IN_KEY = 'isLoggedIn';

export type AdminSession = {
  username: string;
  loggedInAt: string;
};

export type LoginInput = {
  username: string;
  password: string;
};

export type LoginResult = {
  ok: boolean;
  message?: string;
};

export interface AuthProvider {
  login(input: LoginInput): Promise<LoginResult>;
  logout(): void;
  getSession(): AdminSession | null;
}

class ApiAuthProvider implements AuthProvider {
  async login(input: LoginInput): Promise<LoginResult> {
    const username = String(input.username || '').trim();
    const password = String(input.password || '').trim();

    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const payload = await response.json().catch(() => null) as { ok?: boolean; message?: string; username?: string } | null;

      if (!response.ok || !payload?.ok) {
        return { ok: false, message: payload?.message || 'Invalid credentials.' };
      }

      const session: AdminSession = {
        username: String(payload.username || username),
        loggedInAt: new Date().toISOString(),
      };

      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
      localStorage.setItem(ADMIN_LOGGED_IN_KEY, 'true');
      return { ok: true };
    } catch {
      return { ok: false, message: 'Unable to reach auth service.' };
    }
  }

  logout(): void {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(ADMIN_LOGGED_IN_KEY);
  }

  getSession(): AdminSession | null {
    try {
      const isLoggedIn = localStorage.getItem(ADMIN_LOGGED_IN_KEY) === 'true';
      if (!isLoggedIn) return null;

      const raw = localStorage.getItem(ADMIN_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AdminSession;
      if (!parsed?.username) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}

// Replace this provider later with a database-backed implementation.
const authProvider: AuthProvider = new ApiAuthProvider();

export function getAuthProvider(): AuthProvider {
  return authProvider;
}

export function isAdminAuthenticated(): boolean {
  return Boolean(getAuthProvider().getSession());
}
