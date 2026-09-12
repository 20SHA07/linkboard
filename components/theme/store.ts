export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'linkboard.theme';

export interface ThemeSnapshot {
  preference: ThemePreference;
  resolved: ResolvedTheme;
}

const serverSnapshot: ThemeSnapshot = { preference: 'system', resolved: 'light' };
let snapshot = serverSnapshot;
let initialized = false;
const listeners = new Set<() => void>();

function preferenceFrom(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

function systemTheme(): ResolvedTheme {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function resolve(preference: ThemePreference): ThemeSnapshot {
  return { preference, resolved: preference === 'system' ? systemTheme() : preference };
}

export function getThemeSnapshot(): ThemeSnapshot {
  if (!initialized && typeof window !== 'undefined') {
    let preference: ThemePreference = 'system';
    try {
      preference = preferenceFrom(window.localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      // Appearance still works for this page when browser storage is unavailable.
    }
    snapshot = resolve(preference);
    initialized = true;
  }
  return snapshot;
}

export function getServerThemeSnapshot(): ThemeSnapshot {
  return serverSnapshot;
}

/** Also reapplied before paint after React's development Strict Mode remount. */
export function applyTheme(): void {
  const current = getThemeSnapshot();
  document.documentElement.dataset.theme = current.resolved;
  document.documentElement.dataset.themePreference = current.preference;
  document.documentElement.style.colorScheme = current.resolved;
}

function update(preference: ThemePreference): void {
  const next = resolve(preference);
  const changed = next.preference !== snapshot.preference || next.resolved !== snapshot.resolved;
  if (changed) snapshot = next;
  applyTheme();
  if (changed) listeners.forEach((listener) => listener());
}

export function setThemePreference(preference: ThemePreference): void {
  getThemeSnapshot();
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Retain the user's choice in memory; storage failure never blocks the UI.
  }
  update(preference);
}

export function subscribeTheme(listener: () => void): () => void {
  getThemeSnapshot();
  listeners.add(listener);
  const media =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
  const onSystemChange = () => {
    if (snapshot.preference === 'system') update('system');
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null)
      update(preferenceFrom(event.newValue));
  };
  window.addEventListener('storage', onStorage);
  media?.addEventListener('change', onSystemChange);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
    media?.removeEventListener('change', onSystemChange);
  };
}
