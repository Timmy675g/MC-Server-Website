function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

export function assetUrl(path: string): string {
  if (!path) return import.meta.env.BASE_URL || '/';
  if (/^https?:\/\//i.test(path)) return path;

  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = trimSlashes(path);

  return `${cleanBase}${cleanPath}`;
}
