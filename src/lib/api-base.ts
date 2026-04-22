function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizePath(path: string): string {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;

  const normalizedPath = normalizePath(path);
  const configuredBase = String(import.meta.env.VITE_API_BASE || '').trim();

  let safeConfiguredBase = configuredBase;
  // Guard against accidental frontend-domain API base which can trigger redirect loops.
  if (safeConfiguredBase) {
    try {
      const parsed = new URL(safeConfiguredBase);
      const host = parsed.hostname.toLowerCase();
      if (host === 'survivalkendy.systems' || host === 'www.survivalkendy.systems') {
        safeConfiguredBase = 'https://api.survivalkendy.systems';
      }
    } catch {
      // Keep original configured base if it is not a valid URL.
    }
  }

  const normalizedConfiguredBase = safeConfiguredBase
    ? safeConfiguredBase.replace(/^http:\/\/api\.survivalkendy\.systems/i, 'https://api.survivalkendy.systems')
    : '';

  if (!normalizedConfiguredBase) {
    const fallbackBase = import.meta.env.PROD ? 'https://api.survivalkendy.systems' : '';
    if (!fallbackBase) return normalizedPath;
    return `${trimTrailingSlash(fallbackBase)}${normalizedPath}`;
  }

  const base = trimTrailingSlash(normalizedConfiguredBase);
  return `${base}${normalizedPath}`;
}
