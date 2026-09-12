'use client';

import {
  createContext,
  useContext,
  useLayoutEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { applyTheme, getServerThemeSnapshot, getThemeSnapshot, subscribeTheme } from './store';

const ThemeContext = createContext(getServerThemeSnapshot());

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);
  useLayoutEffect(() => {
    // Read the actual browser snapshot, including during the initial hydration pass.
    applyTheme();
  }, [theme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
