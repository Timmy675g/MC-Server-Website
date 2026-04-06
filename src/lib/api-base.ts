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

  if (!configuredBase) return normalizedPath;

  const base = trimTrailingSlash(configuredBase);
  return `${base}${normalizedPath}`;
}
