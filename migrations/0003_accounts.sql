CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
ALTER TABLE pages ADD COLUMN owner_id TEXT REFERENCES accounts(id);
ALTER TABLE pages ADD COLUMN moderation_hidden INTEGER NOT NULL DEFAULT 0;
CREATE INDEX pages_owner_created ON pages(owner_id,created_at);
CREATE TABLE account_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_box TEXT NOT NULL,
  key_tag TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'account' CHECK(purpose IN ('account','recovery')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX account_sessions_user ON account_sessions(user_id);
CREATE INDEX account_sessions_expiry ON account_sessions(expires_at);
CREATE TABLE abuse_reports (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reviewed INTEGER NOT NULL DEFAULT 0
);
-- Old pages keep their content and address. They are claimed by a verified
-- account using the old private owner key; new signups cannot claim them.
DELETE FROM sessions;
