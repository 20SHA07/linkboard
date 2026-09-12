PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'clover',
  font TEXT NOT NULL DEFAULT 'modern',
  shape TEXT NOT NULL DEFAULT 'rounded',
  branding INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  slug_locked INTEGER NOT NULL DEFAULT 0,
  analytics INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  write_token TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'link',
  enabled INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS links_page_position ON links(page_id, position);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  key_tag TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS login_limits (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS login_limits_expiry ON login_limits(expires_at);
CREATE TABLE IF NOT EXISTS stats (
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  link_id TEXT NOT NULL DEFAULT '',
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(page_id, day, link_id)
);
INSERT OR IGNORE INTO pages(id, slug, name, bio, theme, created_at, updated_at)
VALUES('qmc-starter', 'qmc', 'QMC', 'All our socials, in one place.', 'clover', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO links(id,page_id,title,description,icon,enabled,position)
VALUES
 ('qmc-instagram','qmc-starter','Instagram','Photos, stories & updates','instagram',0,0),
 ('qmc-whatsapp','qmc-starter','WhatsApp','Stay in the loop','whatsapp',0,1),
 ('qmc-tiktok','qmc-starter','TikTok','Behind the scenes','tiktok',0,2),
 ('qmc-linkedin','qmc-starter','LinkedIn','Connect with us','linkedin',0,3);
