const THEME_STORAGE_KEY = 'sk-theme';

export type ThemeMode = 'dark' | 'light';

export function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';

  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch (_) {
    // Ignore storage failures and fallback to media query/default.
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', theme);

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (_) {
    // Ignore storage failures.
  }
}

export function resolveAndApplyInitialTheme(): ThemeMode {
  const theme = getInitialTheme();
  applyTheme(theme);
  return theme;
}
