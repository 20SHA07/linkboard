import type { ClickEvent, Profile } from './types';
import { validateProfile } from './validation';

const PROFILE_KEY = 'linkboard:demo:profile:v1';
const EVENTS_KEY = 'linkboard:demo:events:v1';
const MAX_EVENTS = 10_000;

export const demoProfile: Profile = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'alex-morgan',
  name: 'Alex Morgan',
  bio: 'Designer & creative thinker.\nMaking things. Sharing the good stuff.',
  avatarUrl:
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces',
  theme: 'sand',
  backgroundColor: '#f5f1e9',
  published: true,
  links: [
    {
      id: 'website',
      title: 'My little corner of the internet',
      url: 'https://example.com',
      platform: 'website',
      enabled: true,
    },
    {
      id: 'instagram',
      title: 'Life lately, on Instagram',
      url: 'https://www.instagram.com',
      platform: 'instagram',
      enabled: true,
    },
    {
      id: 'youtube',
      title: 'Things I make & share',
      url: 'https://www.youtube.com',
      platform: 'youtube',
      enabled: true,
    },
    {
      id: 'spotify',
      title: 'What’s on repeat',
      url: 'https://open.spotify.com',
      platform: 'spotify',
      enabled: true,
    },
    {
      id: 'github',
      title: 'A few things I’m building',
      url: 'https://github.com',
      platform: 'github',
      enabled: true,
    },
  ],
};

// The in-memory fallback keeps the demo usable in private/restricted browsers.
// This is deliberately NOT an authentication or tenant isolation mechanism.
let memoryProfile = clone(demoProfile);
let memoryEvents: ClickEvent[] = [];
const memoryOnlyKeys = new Set<string>();

export function getDemoStorageWarning(): string | null {
  return memoryOnlyKeys.size
    ? 'Saved for this tab only. Browser storage is unavailable, so some changes may be lost when you reload.'
    : null;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readStored(key: string): unknown {
  try {
    if (memoryOnlyKeys.has(key)) return null;
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: unknown): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(value));
      memoryOnlyKeys.delete(key);
    }
  } catch {
    // Quota/security errors must not prevent editing or following a link.
    memoryOnlyKeys.add(key);
  }
}

export function loadDemoProfile(): Profile {
  const stored = readStored(PROFILE_KEY);
  if (
    stored &&
    typeof stored === 'object' &&
    !validateProfile(stored as Profile) &&
    (stored as Profile).id === demoProfile.id
  ) {
    memoryProfile = clone(stored as Profile);
  }
  return clone(memoryProfile);
}

export function saveDemoProfile(profile: Profile): void {
  const error = validateProfile(profile);
  if (error) throw new Error(error);
  if (profile.id !== demoProfile.id)
    throw new Error(
      'This demo only stores the sample profile. Connect Supabase for separate user accounts.',
    );
  memoryProfile = clone(profile);
  writeStored(PROFILE_KEY, memoryProfile);
}

function isClickEvent(value: unknown): value is ClickEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<ClickEvent>;
  return (
    typeof event.id === 'string' &&
    typeof event.linkId === 'string' &&
    typeof event.timestamp === 'string' &&
    Number.isFinite(Date.parse(event.timestamp))
  );
}

export function loadDemoEvents(): ClickEvent[] {
  const stored = readStored(EVENTS_KEY);
  if (Array.isArray(stored)) memoryEvents = stored.filter(isClickEvent).slice(-MAX_EVENTS);
  return clone(memoryEvents);
}

export function recordDemoClick(profileId: string, linkId: string): void {
  const profile = loadDemoProfile();
  if (
    profile.id !== profileId ||
    !profile.published ||
    !profile.links.some((link) => link.id === linkId && link.enabled)
  )
    return;
  const events = loadDemoEvents();
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  events.push({ id, linkId, timestamp: new Date().toISOString() });
  memoryEvents = events.slice(-MAX_EVENTS);
  writeStored(EVENTS_KEY, memoryEvents);
}
