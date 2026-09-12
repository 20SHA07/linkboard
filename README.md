# Linkboard

A self-hostable link-in-bio application built with Next.js, React, TypeScript, SQLite, and the open-source `qrcode` library. Create an account, customize a profile through the dashboard, and publish it at `/u/username`. Each user has a separate profile, links, theme, and private click analytics.

The default installation includes real authentication and a persistent SQLite database. It starts with no accounts or sample profiles. Supabase is an optional backend for serverless hosting or deployments that prefer managed authentication and Postgres.

The interface uses adapted [Motion Primitives](https://github.com/ibelick/motion-primitives) effects for the navigation highlight, dashboard transitions, and public link entrances. They respect the device's reduced-motion preference. The selected components live in `components/motion/`, use the existing CSS, and retain their MIT attribution in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Start the application

Install Node.js 24 and npm, then run:

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), choose **Create account**, and register with your email address and a password of 12–128 characters. Your new profile starts unpublished, with no links, biography, or image. Registration signs you in so you can customize it and publish when ready.

No external service or environment configuration is required for this local installation. The server creates `data/linkboard.sqlite` automatically. Accounts, profiles, sessions, and clicks persist across browser sessions and application restarts. Use a different email address to create another account; every account has its own dashboard.

| Command             | Purpose                                          |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Start the development server                     |
| `npm run build`     | Build the production application                 |
| `npm start`         | Serve the production build                       |
| `npm run lint`      | Run ESLint                                       |
| `npm run typecheck` | Check TypeScript                                 |
| `npm test`          | Run automated tests                              |
| `npm run test:http` | Verify the production HTTP server after building |

## Customize your profile

Open the dashboard at `/` after signing in. **Edit profile** lets you change your display name, biography, HTTPS image URL, and username. A blank or unavailable image uses an initials avatar. Usernames are unique within your installation and use 3–30 lowercase letters, digits, and single hyphens.

Use **My links** to add destinations, edit labels and URLs, choose a social platform, change the order, and enable or disable individual links. Supported platforms include Instagram, X/Twitter, TikTok, YouTube, LinkedIn, GitHub, Spotify, websites, and email. A profile supports up to 30 links.

Use **Appearance** to select a theme or custom background color. The live preview shows your pending edits. Choose **Save changes** to persist them. Turn on **Publish your page** in the profile settings, save, and open `/u/your-username` to see the public page. Visitors receive only published profiles and enabled links.

Link destinations accept absolute `https://` or `http://` URLs and single-address `mailto:` URLs without extra parameters. Scripts, embedded data, relative destinations, credential-bearing URLs, and malformed input are rejected by validation. Avatar URLs must use HTTPS. Images are loaded from the host you supply, which receives normal image requests from visitors.

## Share the page and QR code

The **QR code** view and **Share your page** dialog display the profile's QR code and let you download a PNG. The public profile also displays a downloadable QR code. It encodes the site's origin plus the saved `/u/username` address.

Before a production build, set `NEXT_PUBLIC_SITE_URL` to your final public origin, such as `https://links.example.com`. Use an origin only, without a path. Without this setting, QR generation uses the currently open site's origin. A localhost QR works only on the device running the app; download the final QR after deployment and scan it from another device before printing it.

Changing your username changes the public address. Save first, then download and redistribute the updated QR code.

## Default backend: SQLite and server authentication

With all Supabase variables empty, Linkboard uses its own server API and SQLite database. `LINKBOARD_DATABASE_PATH` overrides the default `data/linkboard.sqlite` path. This path is server-only and must point to a writable, persistent directory in production. The server initializes its schema automatically.

Passwords are stored as salted scrypt hashes. A successful login creates a random session token; the database stores a hash of the token. The browser receives an `HttpOnly`, `SameSite=Lax` session cookie with a 30-day expiry. Cookies are also `Secure` when the configured site origin or direct request uses HTTPS. Signing out revokes the session. Authenticated API operations derive ownership from the session, so supplying another user's profile ID does not grant access to that profile or its analytics.

**Set `NEXT_PUBLIC_SITE_URL` to the deployed HTTPS origin when serving behind a TLS reverse proxy.** The application does not trust arbitrary forwarded headers to determine a secure origin. State-changing requests require the same origin and JSON bodies are limited to 96 KiB.

This authentication provider uses email as a login identifier. It does not send confirmation emails and does not include a password-reset or account-recovery flow. Keep access credentials safe. If verified email and managed recovery are required, use Supabase and configure its email delivery and recovery handling.

Basic database-backed throttles limit login attempts per email and globally, registrations per email and globally, and public clicks per link and profile. These limits protect a small installation from straightforward abuse; they are not a full bot-detection system. A heavily used deployment may need tuned limits and gateway controls.

Profiles and click history are stored on the server. Every user registers a separate account.

### Storage, backups, and scaling

SQLite uses write-ahead logging. Its `.sqlite`, `-wal`, and `-shm` files belong together while the service is running. Never commit database files, include them in a Docker image, or put them in a publicly served directory. Protect backups because they contain account information and password hashes.

For a simple consistent backup, stop the application cleanly, copy the complete data directory to secure backup storage, then restart the application. Restore the complete directory while the app is stopped, preserving write permissions for the app's user. Do not copy only the main database from a running process and assume the backup contains its latest writes.

Run the built-in database with a single application instance on persistent storage. Do not share it across independent serverless instances or a filesystem without reliable SQLite locking. For multiple application replicas, use Supabase. The built-in API refuses to initialize ephemeral storage on detected Vercel or Netlify deployments when Supabase is missing.

## Optional backend: Supabase

Supabase provides shared Postgres storage and managed authentication. It is the supported backend for Vercel and Netlify. Switching providers selects a different account database; existing SQLite users and profiles are not migrated automatically.

1. Create a Supabase project, or run your own Supabase instance.
2. Run the entire [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor before registering users. This creates the profiles, click events, constraints, RLS policies, and restricted public functions. Keep the `private` schema out of Supabase's exposed API schemas.
3. Copy [`.env.example`](.env.example) to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` and one public key: `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. If both keys are present, the publishable-key value takes precedence. Never use a service-role or secret key in browser configuration.
4. Set `NEXT_PUBLIC_SITE_URL` to the final production origin. In Supabase **Authentication → URL Configuration**, set **Site URL** to that origin. Allow `http://localhost:3000/`, `http://localhost:3000/login`, and your production root/login URLs. The signup confirmation returns to `/`. Allow preview patterns only for deployments you control. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).
5. Enable email/password authentication. Keep email confirmation enabled for public registration, and configure a production SMTP sender in Supabase for reliable delivery.
6. Restart development or rebuild and redeploy. Create an account at `/login`, confirm email if required, and sign in. The database creates an unpublished, empty profile for each account.

All users share one Supabase project, with access isolated by their account IDs. Raw profile reads and writes require ownership. Public visitors call `get_public_profile`, which returns a published profile's public fields and enabled links. Only the owner can read analytics. Database grants and RLS enforce these restrictions independently of the dashboard.

The Supabase client manages its browser session and refresh tokens. The built-in SQLite API is disabled when any Supabase configuration is present; incomplete configuration produces an error instead of silently creating a second account store.

`NEXT_PUBLIC_` values are embedded in the browser bundle at build time. Changing them only when an already-built container starts will not reconfigure the frontend; rebuild after changing providers or the canonical URL. See [Next.js environment variables](https://nextjs.org/docs/pages/guides/environment-variables).

## Click tracking and analytics

Enabled public links remain normal clickable anchors. A client-side handler records the link ID without blocking navigation. The active backend validates that the profile is published and the link is enabled, then stores an event with a server timestamp. A failed analytics request does not prevent the visitor reaching the destination.

Open **Analytics** in your dashboard for click totals, the activity chart, and each link's most recent click time. Refresh to load newly recorded activity. Analytics access is restricted to the account that owns the profile. The events do not contain visitor identifiers or IP addresses.

Consecutive clicks on the same link within 750 milliseconds are suppressed in the current page. These are recorded interactions, not unique visitors or guaranteed traffic counts. Repeated clicks and bots can inflate totals; throttling, blocked JavaScript, network failures, and browser context-menu navigation can miss events. Authentication uses a session cookie or token, but analytics does not set a visitor-tracking cookie.

Supabase reads are paginated so its default row limit does not silently truncate the history. For substantial analytics volume, use database aggregation, an appropriate retention policy, and gateway rate limits. This counter is intended for basic profile analytics, not billing or fraud prevention.

## Deploy with Node or Docker

For a Node server, use Node.js 24, install with `npm ci`, create `.env.local` from the example, and set the final HTTPS site origin. Run `npm run build`, then `npm start` under your service manager. Put a TLS reverse proxy in front of port 3000. Keep the database on persistent storage and back it up separately from the application code.

The included Dockerfile uses Node.js 24, Next.js standalone output, and a non-root runtime user. The Compose configuration mounts a named volume at `/app/data`, where the built-in database is stored. The image initializes that directory with permissions for its runtime user.

To use the built-in backend with Docker:

1. Copy `.env.example` to `.env.local`.
2. Leave the Supabase URL and both keys empty. Set `NEXT_PUBLIC_SITE_URL` to your final HTTPS origin, or leave it empty for a localhost run.
3. Run:

```sh
docker compose --env-file .env.local up --build -d
```

Open port 3000 through your configured host/reverse proxy. Create the first account through the application. Restarting or rebuilding the container preserves the named database volume. Do not remove that volume unless you intend to erase the installation's account and profile data.

For Supabase-backed Docker, populate the Supabase URL and one public key before the same build command. Compose passes the public values as build arguments. The Dockerfile does not provision Supabase.

You can also run the entire Supabase stack yourself using its official [Docker self-hosting guide](https://supabase.com/docs/guides/self-hosting/docker). Run the supplied Linkboard schema against that instance and use its public HTTPS endpoint. Supabase self-hosting requires your own compute, TLS, email service, updates, backups, and monitoring; see its [operational responsibilities](https://supabase.com/docs/guides/self-hosting).

## Free serverless hosting

The application has no paid software dependency. Free hosting and database plans have usage quotas; owning the code does not provide unlimited free infrastructure. Configure Supabase before deploying to either host below. Persistent SQLite on the local filesystem is not supported on these serverless platforms.

### Vercel

Import the Git repository as a Next.js project. Select [Node.js 24](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) and add the Supabase URL, one public key, and final site origin before the build. Deploy, update Supabase's allowed redirects, and rebuild if the public environment values changed. Vercel's free Hobby plan is restricted to personal, non-commercial use; check its [Hobby plan](https://vercel.com/docs/plans/hobby) and [fair-use terms](https://vercel.com/docs/limits/fair-use-guidelines).

### Netlify

Import the repository, choose [Node.js 24](https://docs.netlify.com/build/configure-builds/available-software-at-build-time/), let Netlify detect Next.js, and use `npm run build` with its Next.js adapter. Add the same public Supabase and site variables before building, then configure Supabase's redirect allowlist for the deployed hostname. See [Next.js on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/).

Netlify's free plan has a hard monthly usage limit that can pause sites when reached; review its [current pricing](https://www.netlify.com/pricing/). Supabase also has free-plan limits and may pause inactive projects; see [Supabase pricing](https://supabase.com/pricing).

### GitHub Pages and static-only hosts

This repository requires a Next.js runtime for authentication/API routes and public usernames created after deployment. It is not configured for static export, and uploading `.next` to GitHub Pages will not work. Use the Node/Docker installation or a supported Next.js host with Supabase.

## Verification

Run the local checks with Node.js 24:

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm run test:http
```

The test suite includes input validation, data access/authentication behavior, and database authorization checks. The HTTP check starts the production server with an isolated temporary SQLite database and verifies registration, login, private profiles, account isolation, click tracking, session revocation, and persistence after a server restart. It removes its temporary database afterward and does not use your installation's accounts or data.

Supabase SQL checks run in an isolated [PGlite](https://pglite.dev) PostgreSQL environment with substitutes for the managed auth table and helper. They do not test Supabase Auth, SMTP, PostgREST, or your deployed configuration.

For a Supabase deployment, also run [`supabase/tests/rls.sql`](supabase/tests/rls.sql) in a development project's SQL editor after the schema. It checks anonymous and authenticated access, ownership, draft/disabled-link privacy, click permissions, and timestamps, then rolls back its fixtures. It raises an exception on a failing assertion.

Before sharing a deployment:

1. Register accounts A and B in separate browser profiles. Save different profile data and verify each account restores its own dashboard after signing out and back in.
2. Publish A, open its public page while signed out, and check that disabled links are absent. Unpublish and verify a fresh public request cannot load it.
3. Attempt to read or modify A's private data with B's session using the active backend API. Verify authorization denies access or returns no rows, and A's data stays unchanged.
4. Click an enabled public link and verify only A can read its analytics. An unknown, disabled, or unpublished link must not create an event.
5. Test failed login, invalid URLs, duplicate usernames, unavailable images, and network failures. Confirm unsaved changes are not presented as successfully saved.
6. Restart the self-hosted application and verify saved accounts and profiles persist. Check the production page on mobile and scan its downloaded QR from another device.

## Troubleshooting

| Symptom                                              | Check                                                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `node:sqlite` is unavailable                         | Use Node.js 24 for development, tests, builds, and the server runtime.                               |
| Database cannot be opened                            | Check `LINKBOARD_DATABASE_PATH`, its parent directory's write permissions, and persistent storage.   |
| Accounts disappear after replacing a container       | Restore the original persistent volume. Container-local files are not a durable deployment strategy. |
| Serverless deployment reports configuration required | Set the public Supabase URL and one public key, apply the schema, and rebuild.                       |
| Supabase login works but saving fails                | Run the complete schema and inspect the returned validation or permission error.                     |
| Authentication fails behind a reverse proxy          | Set the final HTTPS `NEXT_PUBLIC_SITE_URL` before building; the browser origin must match it.        |
| Supabase confirmation returns to localhost           | Update Supabase Site URL and allowed redirects for production.                                       |
| Public profile is missing                            | Check the saved username, publishing state, network, and backend availability.                       |
| QR points to an old domain                           | Correct `NEXT_PUBLIC_SITE_URL`, rebuild, and download the QR again.                                  |
| Avatar does not appear                               | Use a directly accessible HTTPS image URL; inaccessible images use the fallback.                     |
| Click totals look incomplete                         | Check enabled/published state, network requests, and the analytics limitations above.                |
