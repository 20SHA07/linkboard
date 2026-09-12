'use client';

import { ChevronDown, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from './provider';
import { setThemePreference, type ThemePreference } from './store';

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { preference } = useTheme();
  const Icon = preference === 'system' ? Monitor : preference === 'dark' ? Moon : Sun;
  return (
    <label
      className={`theme-control${compact ? ' theme-control-compact' : ''}`}
      title="App color theme"
    >
      <Icon size={15} aria-hidden="true" />
      <select
        aria-label="App color theme"
        value={preference}
        onChange={(event) => setThemePreference(event.target.value as ThemePreference)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <ChevronDown className="theme-control-chevron" size={12} aria-hidden="true" />
    </label>
  );
}
