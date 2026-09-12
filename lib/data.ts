'use client';

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Account, ClickEvent, Profile, SocialLink, Theme } from './types';
import {
  getDemoStorageWarning,
  loadDemoEvents,
  loadDemoProfile,
  recordDemoClick,
  saveDemoProfile,
} from './demo';
import { validateEmail, validateProfile, validateUsername } from './validation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  '';

/** Missing configuration runs an explicitly labelled, browser-local demo. */
export const isDemo = !supabaseUrl && !supabaseKey;
let client: SupabaseClient | undefined;

function getClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseKey)
    throw new Error(
      'Supabase is not fully configured. Set the public project URL and publishable key, then rebuild the site.',
    );
  if (!client) {
    client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

function accountFromUser(user: User | null): Account | null {
  return user ? { id: user.id, email: user.email || '' } : null;
}

function readableError(error: { message?: string; code?: string } | null, fallback: string): Error {
  if (error?.code === '23505')
    return new Error('That username is already taken. Please choose another.');
  if (error?.code === '23514')
    return new Error('Some profile details did not pass validation. Check the form and try again.');
  if (error?.code === '42501')
    return new Error(
      'You do not have permission to change this profile. Sign in to your own account.',
    );
  if (error?.code === 'PGRST205' || error?.code === '42P01')
    return new Error(
      'The database is not set up yet. Run supabase/schema.sql in your Supabase SQL editor.',
    );
  return new Error(error?.message || fallback);
}

export async function getCurrentUser(): Promise<Account | null> {
  if (isDemo) return null;
  const { data, error } = await getClient().auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError')
    throw readableError(error, 'Could not check your session. Please try again.');
  return accountFromUser(data.user);
}

export function subscribeAuth(callback: (account: Account | null) => void): () => void {
  if (isDemo) return () => {};
  const { data } = getClient().auth.onAuthStateChange((_event, session) => {
    // Keep this callback synchronous; awaiting Supabase calls here can deadlock.
    callback(accountFromUser(session?.user ?? null));
  });
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<void> {
  if (isDemo)
    throw new Error(
      'Connect Supabase to sign in. The demo does not create or authenticate user accounts.',
    );
  if (!validateEmail(email.trim())) throw new Error('Enter a valid email address.');
  if (!password) throw new Error('Enter your password.');
  const { error } = await getClient().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw readableError(error, 'Sign-in failed. Please try again.');
}

export async function signUp(
  email: string,
  password: string,
): Promise<{ confirmationRequired: boolean }> {
  if (isDemo)
    throw new Error(
      'Connect Supabase to create separate, secure user accounts. The demo is stored in this browser only.',
    );
  if (!validateEmail(email.trim())) throw new Error('Enter a valid email address.');
  if (password.length < 12 || password.length > 128)
    throw new Error('Use a password with 12–128 characters.');
  // Static-host friendly: Supabase returns the confirmed session to the same app.
  const redirect =
    typeof window !== 'undefined'
      ? `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`
      : undefined;
  const { data, error } = await getClient().auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: redirect },
  });
  if (error) throw readableError(error, 'Could not create your account. Please try again.');
  return { confirmationRequired: !data.session };
}

export async function signOut(): Promise<void> {
  if (isDemo) return;
  const { error } = await getClient().auth.signOut();
  if (error) throw readableError(error, 'Could not sign out. Please try again.');
}

interface ProfileRow {
  id: string;
  username: string;
  name: string;
  bio: string;
  avatar_url: string;
  theme: Theme;
  background_color: string;
  links: SocialLink[];
  published: boolean;
}

const PROFILE_COLUMNS = 'id,username,name,bio,avatar_url,theme,background_color,links,published';

function fromRow(row: ProfileRow): Profile {
  const profile: Profile = {
    id: row.id,
    username: row.username,
    name: row.name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    theme: row.theme,
    backgroundColor: row.background_color,
    links: row.links,
    published: row.published,
  };
  const error = validateProfile(profile);
  if (error)
    throw new Error('This profile contains invalid data. Ask the account owner to update it.');
  return profile;
}

export async function loadDashboard(
  userId?: string,
): Promise<{ profile: Profile; events: ClickEvent[] }> {
  if (isDemo) return { profile: loadDemoProfile(), events: loadDemoEvents() };
  const account = await getCurrentUser();
  if (!account) throw new Error('Sign in to view your dashboard.');
  if (userId && userId !== account.id) throw new Error('You can only open your own dashboard.');
  const database = getClient();
  const { data, error } = await database
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', account.id)
    .single<ProfileRow>();
  if (error) throw readableError(error, 'Could not load your profile.');
  if (!data)
    throw new Error(
      'Your profile is missing. Ask the site administrator to run the database setup.',
    );

  // Use a server-generated event timestamp for the snapshot, never the visitor's
  // clock. Supabase defaults to 1,000 rows; paginate to avoid silent undercounts.
  const latest = await database
    .from('click_events')
    .select('created_at')
    .eq('profile_id', account.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string }>();
  if (latest.error) throw readableError(latest.error, 'Could not load analytics. Please refresh.');
  if (!latest.data) return { profile: fromRow(data), events: [] };
  const cutoff = latest.data.created_at;
  const events: ClickEvent[] = [];
  const pageSize = 1_000;
  for (let offset = 0; ; offset += pageSize) {
    const result = await database
      .from('click_events')
      .select('id,link_id,created_at')
      .eq('profile_id', account.id)
      .lte('created_at', cutoff)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (result.error)
      throw readableError(result.error, 'Could not load analytics. Please refresh.');
    const rows = result.data as { id: string; link_id: string; created_at: string }[];
    events.push(
      ...rows.map((row) => ({ id: row.id, linkId: row.link_id, timestamp: row.created_at })),
    );
    if (rows.length < pageSize) break;
  }
  return { profile: fromRow(data), events };
}

export async function saveProfile(profile: Profile): Promise<void> {
  const validationError = validateProfile(profile);
  if (validationError) throw new Error(validationError);
  if (isDemo) {
    saveDemoProfile(profile);
    return;
  }
  const account = await getCurrentUser();
  if (!account || account.id !== profile.id)
    throw new Error('Sign in to the account that owns this profile.');
  // URL.href canonicalizes international hostnames to ASCII/punycode and
  // percent-encodes paths so browser validation and database constraints agree.
  const canonicalUrl = (url: string) => (/^https?:\/\//i.test(url) ? new URL(url).href : url);
  const { data, error } = await getClient()
    .from('profiles')
    .update({
      username: profile.username,
      name: profile.name.trim(),
      bio: profile.bio,
      avatar_url: canonicalUrl(profile.avatarUrl),
      theme: profile.theme,
      background_color: profile.backgroundColor,
      links: profile.links.map((link) => ({ ...link, url: canonicalUrl(link.url) })),
      published: profile.published,
    })
    .eq('id', account.id)
    .select('id')
    .single();
  if (error) throw readableError(error, 'Could not save your profile. Please try again.');
  if (!data) throw new Error('The profile was not saved. Sign in again and retry.');
}

export function getPersistenceWarning(): string | null {
  return isDemo ? getDemoStorageWarning() : null;
}

export async function getPublicProfile(username: string): Promise<Profile | null> {
  if (!validateUsername(username)) return null;
  if (isDemo) {
    const profile = loadDemoProfile();
    return profile.username === username && profile.published
      ? { ...profile, links: profile.links.filter((link) => link.enabled) }
      : null;
  }
  const { data, error } = await getClient().rpc('get_public_profile', { p_username: username });
  if (error) throw readableError(error, 'This profile could not be loaded. Please try again.');
  return data ? fromRow(data as ProfileRow) : null;
}

const recentClicks = new Map<string, number>();

/** Best-effort analytics. Callers should always allow navigation on rejection. */
export async function trackClick(profileId: string, linkId: string): Promise<void> {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(linkId) || !/^[0-9a-f-]{36}$/i.test(profileId)) return;
  const key = `${profileId}:${linkId}`;
  const now = Date.now();
  if (now - (recentClicks.get(key) || 0) < 750) return;
  recentClicks.set(key, now);
  if (recentClicks.size > 200) {
    for (const [entry, timestamp] of recentClicks)
      if (now - timestamp > 750) recentClicks.delete(entry);
  }
  if (isDemo) {
    recordDemoClick(profileId, linkId);
    return;
  }
  const { error } = await getClient().rpc('track_link_click', {
    p_profile_id: profileId,
    p_link_id: linkId,
  });
  if (error) throw readableError(error, 'The click could not be recorded.');
}
