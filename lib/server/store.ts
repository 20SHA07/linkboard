import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Account, ClickEvent, Profile } from '../types';
import { validateEmail, validateProfile, validateUsername } from '../validation';
import { getDatabase, transaction } from './database';
import { HttpError } from './errors';

export const SESSION_SECONDS = 60 * 60 * 24 * 30;
const MINUTE = 60_000;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function derivePassword(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(24).toString('hex');
  const key = await derivePassword(password, salt);
  return `scrypt-v1:${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password: string, encoded?: string): Promise<boolean> {
  const [version, salt, digest] = (encoded || '').split(':');
  const valid =
    version === 'scrypt-v1' &&
    /^[a-f0-9]{48}$/.test(salt || '') &&
    /^[a-f0-9]{128}$/.test(digest || '');
  // Unknown emails still do the same expensive derivation as registered emails.
  const actual = await derivePassword(
    password,
    valid ? salt : '000000000000000000000000000000000000000000000000',
  );
  const expected = valid ? Buffer.from(digest, 'hex') : Buffer.alloc(64);
  return timingSafeEqual(actual, expected) && valid;
}

export function readCredentials(
  value: unknown,
  signup = false,
): { email: string; password: string } {
  if (!value || typeof value !== 'object')
    throw new HttpError(400, 'Enter your email and password.');
  const input = value as Record<string, unknown>;
  if (
    typeof input.email !== 'string' ||
    input.email.length > 254 ||
    !validateEmail(input.email.trim())
  )
    throw new HttpError(400, 'Enter a valid email address.');
  if (
    typeof input.password !== 'string' ||
    input.password.length > 128 ||
    input.password.length < (signup ? 12 : 1)
  )
    throw new HttpError(
      400,
      signup
        ? 'Use a password with 12–128 characters.'
        : 'Enter a password of at most 128 characters.',
    );
  return { email: input.email.trim().toLowerCase(), password: input.password };
}

function conflict(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed');
}

function readProfile(document: string): Profile {
  const profile = JSON.parse(document) as Profile;
  if (validateProfile(profile)) throw new Error('Stored profile validation failed.');
  return profile;
}

/** A durable, single-node backend. Every owner operation requires a server session. */
export class BuiltinStore {
  constructor(private readonly database: DatabaseSync = getDatabase()) {}

  private limit(key: string, maximum: number, duration: number): void {
    const now = Date.now();
    const row = this.database
      .prepare(
        `
      INSERT INTO rate_limits(key, count, expires_at) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET
        count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END,
        expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
      RETURNING count, expires_at
    `,
      )
      .get(hashToken(key), now + duration, now, now) as { count: number; expires_at: number };
    if (row.count > maximum)
      throw new HttpError(
        429,
        'Too many requests. Please wait and try again.',
        Math.max(1, Math.ceil((row.expires_at - now) / 1000)),
      );
  }

  private cleanup(): void {
    const now = Date.now();
    this.database.prepare('DELETE FROM rate_limits WHERE expires_at <= ?').run(now);
    this.database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  }

  private createSession(accountId: string): string {
    const token = randomBytes(32).toString('base64url');
    this.database
      .prepare('INSERT INTO sessions(token_hash, account_id, expires_at) VALUES (?, ?, ?)')
      .run(hashToken(token), accountId, Date.now() + SESSION_SECONDS * 1000);
    return token;
  }

  account(token: string | null): Account | null {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const row = this.database
      .prepare(
        `
      SELECT accounts.id, accounts.email FROM sessions
      JOIN accounts ON accounts.id = sessions.account_id
      WHERE token_hash = ? AND expires_at > ?
    `,
      )
      .get(hashToken(token), Date.now()) as { id: string; email: string } | undefined;
    return row ? { id: row.id, email: row.email } : null;
  }

  private requireAccount(token: string | null): Account {
    const account = this.account(token);
    if (!account) throw new HttpError(401, 'Sign in to access your dashboard.');
    return account;
  }

  async signup(value: unknown): Promise<{ account: Account; token: string }> {
    const { email, password } = readCredentials(value, true);
    this.cleanup();
    this.limit('signup:global', 20, 60 * MINUTE);
    this.limit(`signup:email:${email}`, 5, 60 * MINUTE);
    const passwordHash = await hashPassword(password);
    const account = { id: randomUUID(), email };
    const profile: Profile = {
      id: account.id,
      username: `member-${randomBytes(8).toString('hex')}`,
      name: email.split('@')[0].slice(0, 60) || 'Your name',
      bio: '',
      avatarUrl: '',
      theme: 'sand',
      backgroundColor: '#f6f4ef',
      links: [],
      published: false,
    };
    try {
      return transaction(this.database, () => {
        this.database
          .prepare('INSERT INTO accounts(id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
          .run(account.id, email, passwordHash, Date.now());
        this.database
          .prepare('INSERT INTO profiles(id, username, document) VALUES (?, ?, ?)')
          .run(account.id, profile.username, JSON.stringify(profile));
        return { account, token: this.createSession(account.id) };
      });
    } catch (error) {
      if (conflict(error))
        throw new HttpError(409, 'An account with this email already exists. Sign in instead.');
      throw error;
    }
  }

  async signin(value: unknown): Promise<{ account: Account; token: string }> {
    const { email, password } = readCredentials(value);
    this.cleanup();
    this.limit('signin:global', 250, 15 * MINUTE);
    this.limit(`signin:email:${email}`, 10, 15 * MINUTE);
    const row = this.database
      .prepare('SELECT id, email, password_hash FROM accounts WHERE email = ?')
      .get(email) as { id: string; email: string; password_hash: string } | undefined;
    if (!(await verifyPassword(password, row?.password_hash)) || !row)
      throw new HttpError(401, 'The email or password is incorrect.');
    return { account: { id: row.id, email: row.email }, token: this.createSession(row.id) };
  }

  signout(token: string | null): void {
    if (token)
      this.database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }

  dashboard(token: string | null): { profile: Profile; events: ClickEvent[] } {
    const account = this.requireAccount(token);
    const row = this.database
      .prepare('SELECT document FROM profiles WHERE id = ?')
      .get(account.id) as { document: string } | undefined;
    if (!row) throw new HttpError(404, 'Your profile could not be found.');
    const events = this.database
      .prepare(
        `
      SELECT id, link_id AS linkId, occurred_at AS timestamp FROM click_events
      WHERE profile_id = ? ORDER BY occurred_at ASC, id ASC
    `,
      )
      .all(account.id) as unknown as ClickEvent[];
    return { profile: readProfile(row.document), events };
  }

  saveProfile(token: string | null, value: unknown): void {
    const account = this.requireAccount(token);
    const input = value as Profile;
    const error = validateProfile(input);
    if (error) throw new HttpError(400, error);
    if (input.id !== account.id) throw new HttpError(403, 'You can only change your own profile.');
    const canonicalUrl = (url: string) => (/^https?:\/\//i.test(url) ? new URL(url).href : url);
    const profile: Profile = {
      id: account.id,
      username: input.username,
      name: input.name.trim(),
      bio: input.bio,
      avatarUrl: canonicalUrl(input.avatarUrl),
      theme: input.theme,
      backgroundColor: input.backgroundColor,
      published: input.published,
      links: input.links.map((link) => ({
        id: link.id,
        title: link.title.trim(),
        url: canonicalUrl(link.url),
        platform: link.platform,
        enabled: link.enabled,
      })),
    };
    const canonicalError = validateProfile(profile);
    if (canonicalError) throw new HttpError(400, canonicalError);
    try {
      const result = this.database
        .prepare('UPDATE profiles SET username = ?, document = ? WHERE id = ?')
        .run(profile.username, JSON.stringify(profile), account.id);
      if (!result.changes) throw new HttpError(404, 'Your profile could not be found.');
    } catch (error) {
      if (conflict(error))
        throw new HttpError(409, 'That username is already taken. Please choose another.');
      throw error;
    }
  }

  publicProfile(username: string): Profile | null {
    if (!validateUsername(username)) return null;
    const row = this.database
      .prepare('SELECT document FROM profiles WHERE username = ?')
      .get(username) as { document: string } | undefined;
    if (!row) return null;
    const profile = readProfile(row.document);
    return profile.published
      ? { ...profile, links: profile.links.filter((link) => link.enabled) }
      : null;
  }

  click(value: unknown): void {
    if (!value || typeof value !== 'object')
      throw new HttpError(400, 'A profile and link are required.');
    const { profileId, linkId } = value as Record<string, unknown>;
    if (
      typeof profileId !== 'string' ||
      !/^[a-f0-9-]{36}$/i.test(profileId) ||
      typeof linkId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(linkId)
    )
      throw new HttpError(400, 'Choose a valid profile and link.');
    // Lookups and writes stay in one synchronous transaction, so publication
    // changes cannot race an accepted click or cause a private link to be counted.
    transaction(this.database, () => {
      const row = this.database
        .prepare('SELECT document FROM profiles WHERE id = ?')
        .get(profileId) as { document: string } | undefined;
      const profile = row ? readProfile(row.document) : null;
      if (!profile?.published || !profile.links.some((link) => link.id === linkId && link.enabled))
        throw new HttpError(404, 'This link is not available.');
      this.limit(`click:profile:${profileId}`, 600, MINUTE);
      this.limit(`click:link:${profileId}:${linkId}`, 120, MINUTE);
      this.database
        .prepare(
          'INSERT INTO click_events(id, profile_id, link_id, occurred_at) VALUES (?, ?, ?, ?)',
        )
        .run(randomUUID(), profileId, linkId, new Date().toISOString());
    });
  }
}
