const ADMIN_USERNAME = 'Admin';
const ADMIN_PASSWORD_PARTS = ['Survival', 'Kendy', '2026'];
const DEFAULT_ADMIN_PASSWORD = ADMIN_PASSWORD_PARTS.join('');
const ADMIN_PASSWORD = String(import.meta.env.VITE_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD);
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

class HardcodedAuthProvider implements AuthProvider {
  async login(input: LoginInput): Promise<LoginResult> {
    const username = String(input.username || '').trim();
    const password = String(input.password || '').trim();

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return { ok: false, message: 'Invalid credentials.' };
    }

    const session: AdminSession = {
      username,
      loggedInAt: new Date().toISOString(),
    };

    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(ADMIN_LOGGED_IN_KEY, 'true');
    return { ok: true };
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
const authProvider: AuthProvider = new HardcodedAuthProvider();

export function getAuthProvider(): AuthProvider {
  return authProvider;
}

export function isAdminAuthenticated(): boolean {
  return Boolean(getAuthProvider().getSession());
}
