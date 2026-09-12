# Linkboard

A self-hostable link-in-bio application built with Next.js, React, TypeScript, SQLite, and the open-source `qrcode` library. Create an account, customize a profile through the dashboard, and publish its personal public address. Each user has a separate profile, links, theme, and private click analytics.

The default server installation includes real authentication and a persistent SQLite database. It starts with no accounts or sample profiles. Supabase supports GitHub Pages, serverless hosting, and deployments that prefer managed authentication and Postgres. On GitHub Pages, an installation guide is visible until Supabase is connected; account creation, saved profiles, and analytics become available after configuration and redeployment.

**[Open Linkboard on GitHub Pages](https://20sha07.github.io/linkboard/)** · **[Set up Supabase and finish deployment](#github-pages-deployment)**

The interface uses adapted [Motion Primitives](https://github.com/ibelick/motion-primitives) effects for the navigation highlight, dashboard transitions, and public link entrances. They respect the device's reduced-motion preference. The selected components live in `components/motion/`, use the existing CSS, and retain their MIT attribution in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Start the application

Install Node.js 24 and npm, then run:

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), choose **Create account**, and register with your email address and a password of 12–128 characters. Your new profile starts unpublished, with no links, biography, or image. Registration signs you in so you can customize it and publish when ready.

No external service or environment configuration is required for this local installation. The server creates `data/linkboard.sqlite` automatically. Accounts, profiles, sessions, and clicks persist across browser sessions and application restarts. Use a different email address to create another account; every account has its own dashboard.

| Command               | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| `npm run dev`         | Start the development server                     |
| `npm run build`       | Build the production application                 |
| `npm run build:pages` | Export the Pages application to `out-pages/`     |
| `npm start`           | Serve the production build                       |
| `npm run lint`        | Run ESLint                                       |
| `npm run typecheck`   | Check TypeScript                                 |
| `npm test`            | Run automated tests                              |
| `npm run test:http`   | Verify the production HTTP server after building |

## Customize your profile

Open the dashboard at `/` after signing in. **Edit profile** lets you change your display name, biography, HTTPS image URL, and username. A blank or unavailable image uses an initials avatar. Usernames are unique within your installation and use 3–30 lowercase letters, digits, and single hyphens.

Use **My links** to add destinations, edit labels and URLs, choose a social platform, change the order, and enable or disable individual links. Supported platforms include Instagram, X/Twitter, TikTok, YouTube, LinkedIn, GitHub, Spotify, websites, and email. A profile supports up to 30 links.

Use **Appearance** to select a theme or custom background color. The live preview shows your pending edits. For a private profile, choose **Save draft** to keep your work private, or **Publish page** in the sticky top bar to save your edits and make the page public. After publishing, use **Save changes** for updates and **View page** to visit your public address. You can make it private again with the publication switch in Settings and save. Visitors receive only published profiles and enabled links.

The interface theme control offers **Light**, **Dark**, and **System**. System follows your device preference. The choice is saved in this browser under `linkboard.theme`; it contains only a display preference. Your public profile's background and theme remain controlled by the profile owner through **Appearance**.

Link destinations accept absolute `https://` or `http://` URLs and single-address `mailto:` URLs without extra parameters. Scripts, embedded data, relative destinations, credential-bearing URLs, and malformed input are rejected by validation. Avatar URLs must use HTTPS. Images are loaded from the host you supply, which receives normal image requests from visitors.

## Share the page and QR code

The **QR code** view and **Share your page** dialog display the profile's QR code and let you download a PNG. The public profile also displays a downloadable QR code. It encodes the saved profile address for the current hosting mode: `/u/username` on a server, or `/linkboard/u/?username=username` on the configured GitHub Pages project. The application creates these links automatically; account and profile customization still happens entirely through dashboard forms.

Before a production build, set `NEXT_PUBLIC_SITE_URL` to your final public origin, such as `https://links.example.com`. Use an origin only, without a path. For a project site, set `NEXT_PUBLIC_BASE_PATH` separately, such as `/linkboard`. Without a configured origin, QR generation uses the currently open site's origin. A localhost QR works only on the device running the app; download the final QR after deployment and scan it from another device before printing it.

Changing your username changes the public address. Save first, then download and redistribute the updated QR code.

## Default backend: SQLite and server authentication

In a normal server build with all Supabase variables empty, Linkboard uses its own server API and SQLite database. `LINKBOARD_DATABASE_PATH` overrides the default `data/linkboard.sqlite` path. This path is server-only and must point to a writable, persistent directory in production. The server initializes its schema automatically.

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

Supabase provides shared Postgres storage and managed authentication. It is the required account backend for GitHub Pages, Vercel, and Netlify. Switching providers selects a different account database; existing SQLite users and profiles are not migrated automatically. For this repository's Pages site, follow the complete [GitHub Pages instructions](#github-pages-deployment) below.

1. Create a Supabase project, or run your own Supabase instance.
2. Run the entire [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor before registering users. This creates the profiles, click events, constraints, RLS policies, and restricted public functions. Keep the `private` schema out of Supabase's exposed API schemas.
3. Copy [`.env.example`](.env.example) to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` and one public key: `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. If both keys are present, the publishable-key value takes precedence. Never use a service-role or secret key in browser configuration.
4. Set `NEXT_PUBLIC_SITE_URL` to the final production origin. In Supabase **Authentication → URL Configuration**, set **Site URL** to the app's root URL, including its project path when applicable. Allow `http://localhost:3000/`, `http://localhost:3000/login`, and your production app-root/login URLs. Signup confirmation returns to the app's root, including `NEXT_PUBLIC_BASE_PATH`. Allow preview patterns only for deployments you control. The exact GitHub Pages addresses appear below. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).
5. Enable email/password authentication. Keep email confirmation enabled for public registration, and configure a custom SMTP sender in Supabase. Its default sender is limited to project-team addresses and a very small hourly quota; see [Supabase SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp).
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

## GitHub Pages deployment

The public site is [https://20sha07.github.io/linkboard/](https://20sha07.github.io/linkboard/). GitHub Pages serves the application, styles, fonts, images, and JavaScript. Supabase supplies authentication, profile storage, and click analytics. This deployment does not need Vercel, Netlify, a running local computer, a separate Node server, or a custom domain.

With no Supabase configuration, the deployed application displays an installation guide with dark mode and setup links. It does not accept credentials or create local/sample accounts. Follow these steps to activate the account dashboard and public profiles. Completing setup once serves all users; each person then registers their own account.

### 1. Create your Supabase project

1. Sign in to the [Supabase dashboard](https://supabase.com/dashboard) and choose **New project**.
2. Choose your organization, enter a project name such as `linkboard`, set a database password, and choose a region near your users. Keep the database password in your password manager; Linkboard's browser configuration does not need it.
3. Create the project and wait for provisioning to finish. A free project can serve a small installation within its quotas; review [Supabase's current plan limits](https://supabase.com/pricing).

See the official [project and database setup guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs).

### 2. Install Linkboard's database schema

1. Open the repository's [`supabase/schema.sql`](https://github.com/20SHA07/linkboard/blob/main/supabase/schema.sql). Use **Copy raw file** to copy the entire SQL file.
2. In your Supabase project, open **SQL Editor**, create a **New query**, paste the SQL, and click **Run**. Run the complete file, from `begin;` through `commit;`, before creating any Linkboard accounts.
3. Confirm the query finishes without errors. It creates the profile and click tables, the account-to-profile trigger, validation, and Row Level Security (RLS) rules. These rules keep each user's private data separate; leave them enabled.
4. Ensure the project's **Data API** is enabled and its exposed schemas include `public`. Keep `private` out of the exposed schemas. If the Data API was disabled at project creation, enable it under **Integrations → Data API**. The supplied SQL grants the necessary access; you do not need to make the tables publicly readable.

No storage bucket or file-upload service is required. The avatar field uses a directly accessible HTTPS image URL and falls back to initials when the image cannot load.

### 3. Configure email login and confirmation

In the project's [Authentication URL Configuration](https://supabase.com/dashboard/project/_/auth/url-configuration), select your project if prompted and save:

| Setting                     | Value                                        |
| --------------------------- | -------------------------------------------- |
| Site URL                    | `https://20sha07.github.io/linkboard/`       |
| Allowed production redirect | `https://20sha07.github.io/linkboard/`       |
| Allowed login redirect      | `https://20sha07.github.io/linkboard/login/` |

Add both redirect entries individually, including the trailing slash and `/linkboard/`. For local development, you may also add `http://localhost:3000/` and `http://localhost:3000/login`. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

In **Authentication → Sign In / Providers → Email**, enable email/password sign-in and keep **Confirm email** enabled for public registration. Hosted projects enable email confirmation by default. Keep Supabase's default confirmation email template, which uses its confirmation URL; Linkboard does not require a custom `/auth/confirm` server route. See [Supabase email authentication](https://supabase.com/docs/guides/auth/passwords).

For public users to receive confirmation emails, configure the project's [custom SMTP settings](https://supabase.com/dashboard/project/_/auth/smtp). Obtain the host, port, username, password, and verified sender address from your email provider, then save those values in Supabase. SMTP credentials belong only in Supabase. The built-in sender is restricted to project-team email addresses and currently allows only two messages per hour, so it cannot support ordinary public signup. Delivery providers have their own pricing and quotas. See [Supabase's SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).

You can test confirmation with your project-team email before adding SMTP. For a private installation, disabling **Confirm email** permits immediate email/password registration but does not verify email ownership. Keep confirmation enabled when accepting public accounts. Linkboard currently has no password-reset form; SMTP setup alone does not add that interface.

### 4. Add the two public connection values to GitHub

Open the Supabase project's **Connect** dialog and copy its **Project URL** and **Publishable key**. The URL normally looks like `https://YOUR-PROJECT-REF.supabase.co`; the key starts with `sb_publishable_`. You can also find or create a publishable key under **Settings → API Keys**. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

Open this repository's [Actions variables settings](https://github.com/20SHA07/linkboard/settings/variables/actions). Under **Repository variables**, click **New repository variable** for each row:

| Name                                   | Value to paste                    |
| -------------------------------------- | --------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Your Supabase **Project URL**     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase **Publishable key** |

Paste the actual value without quotation marks. Do not use the database password, an `sb_secret_` key, or a `service_role` key. Public keys are intended for browser applications; user access is enforced by authentication and the RLS policies installed in step 2. The legacy public `anon` key is also supported through `NEXT_PUBLIC_SUPABASE_ANON_KEY`, but use a publishable key for a new project. If both public-key variables are present, the publishable value takes precedence.

The Pages workflow derives the final site origin and project path from GitHub, so you do not need to add `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_BASE_PATH` to GitHub for this repository. See [GitHub repository variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables).

### 5. Rebuild and deploy the connected application

1. Open [Settings → Pages](https://github.com/20SHA07/linkboard/settings/pages). Under **Build and deployment**, select **GitHub Actions** as the source if it is not already selected.
2. Open [Actions → Deploy GitHub Pages](https://github.com/20SHA07/linkboard/actions/workflows/pages.yml).
3. Click **Run workflow**, select branch **main**, and click the green **Run workflow** button.
4. Open the new run and wait for both the **build** and **deploy** jobs to finish successfully. The deployment job links to the published site.
5. Reload [Linkboard](https://20sha07.github.io/linkboard/) after deployment. The installation guide is replaced by the real login flow. If you still see the old page, refresh without cache or open a private browsing window.

**Saving GitHub variables does not automatically rebuild the site. Run the workflow after adding or changing them.** Future pushes to `main` deploy automatically. No `.env.local` file or local build is required for the GitHub Actions deployment. See [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

The [Pages workflow](.github/workflows/pages.yml) publishes an installation guide when all Supabase values are empty. A partial URL/key pair or an invalid/private key fails the build and leaves the previous deployment in place. A valid key format does not prove that the schema, email delivery, or project settings are correct; complete the account check below.

### 6. Create users, publish profiles, and verify sharing

1. Open [Create account / Sign in](https://20sha07.github.io/linkboard/login/), choose **Create account**, and register with your email and a password of 12–128 characters. Confirm the email if required, then sign in.
2. Use **Edit profile**, **My links**, and **Appearance** to set your name, biography, avatar URL, links, and background. Select **Save draft** to save while keeping your page private.
3. Select **Publish page** in the top bar, then **View page**. The app creates your address automatically, such as `/linkboard/u/?username=your-name`.
4. Open that address while signed out, click a social link, then return to **Analytics** in your dashboard and refresh. Download the PNG in **QR code** and scan it from a second device to check the final deployed address.
5. Another person repeats account registration with a different email. They receive a separate unpublished profile and private dashboard; you do not create another Supabase project or edit JSON for them.

The application interface has Light, Dark, and System modes. Each browser remembers its selection. Profile themes remain controlled by their owners. Accounts, profiles, and analytics live in Supabase across devices; the browser theme preference is stored locally.

### Build the Pages artifact locally

Local export is optional. Copy `.env.example` to `.env.local` and set:

```dotenv
NEXT_PUBLIC_SITE_URL=https://20sha07.github.io
NEXT_PUBLIC_BASE_PATH=/linkboard
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-ACTUAL-PUBLISHABLE-KEY
```

Replace the two Supabase placeholders with your project's values. To export the installation guide before connecting a project, leave the URL and both public-key variables empty. Then run:

```sh
npm ci
npm run build:pages
```

The script sets `NEXT_PUBLIC_STATIC_EXPORT=true` for its isolated build, excludes server API/database code, and writes the static artifact to `out-pages/`. It validates a supplied HTTPS backend URL and public key format and rejects partial, secret, or service-role credentials. This structural check does not contact your project to verify that its configuration works. The normal server source and build remain available for Node/Docker deployments.

Public profile addresses use `/linkboard/u/?username=your-name` so new accounts work without rebuilding a separate HTML file per username. This parameter selects a saved profile; names, bios, links, themes, and publishing are edited in the dashboard. Generated share links and QR codes include the project path automatically.

The `out-pages/` artifact can also be served by another static host configured for the same base path and Supabase backend. Use `npm run build` for the normal server application and `npm run build:pages` for this static artifact.

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

For manual visual checks, run `npm run test:http -- --review` in an interactive terminal. After the HTTP checks pass, it prints the temporary account's local URL and generated login credentials. Press Enter when finished to stop that test server and delete its database.

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

| Symptom                                              | Check                                                                                                                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node:sqlite` is unavailable                         | Use Node.js 24 for development, tests, builds, and the server runtime.                                                                                     |
| Database cannot be opened                            | Check `LINKBOARD_DATABASE_PATH`, its parent directory's write permissions, and persistent storage.                                                         |
| Accounts disappear after replacing a container       | Restore the original persistent volume. Container-local files are not a durable deployment strategy.                                                       |
| Serverless deployment reports configuration required | Set the public Supabase URL and one public key, apply the schema, and rebuild.                                                                             |
| Pages shows the installation guide                   | Complete the Supabase schema and Auth setup, add both public connection values to repository Actions variables, then manually run **Deploy GitHub Pages**. |
| Pages build reports incomplete/invalid configuration | Supply the project URL and one valid public key together, without quotation marks. Clearing all three Supabase values exports the installation guide.      |
| Pages still serves an older root page                | Set Pages Source to **GitHub Actions** and rerun **Deploy GitHub Pages** after the current workflow succeeds.                                              |
| Pages confirmation or QR loses `/linkboard/`         | Keep the canonical site value origin-only, set `NEXT_PUBLIC_BASE_PATH=/linkboard`, and allow the full project-root/login redirects in Supabase.            |
| Supabase login works but saving fails                | Run the complete schema and inspect the returned validation or permission error.                                                                           |
| Authentication fails behind a reverse proxy          | Set the final HTTPS `NEXT_PUBLIC_SITE_URL` before building; the browser origin must match it.                                                              |
| Supabase confirmation returns to localhost           | Update Supabase Site URL and allowed redirects for production.                                                                                             |
| Signup says the email address is not authorized      | Configure custom SMTP; Supabase's built-in sender only delivers to project-team email addresses.                                                           |
| Signup reports an email rate limit                   | Check Supabase's Auth email limits and your SMTP provider's quota. Wait for the limit to reset; repeated retries do not bypass it.                         |
| Supabase reports that a table or function is missing | Run the whole `supabase/schema.sql` in the same project whose URL/key you configured, and ensure its Data API exposes `public`.                            |
| Public profile is missing                            | Check the saved username, publishing state, network, and backend availability.                                                                             |
| QR points to an old domain                           | Correct `NEXT_PUBLIC_SITE_URL`, rebuild, and download the QR again.                                                                                        |
| Avatar does not appear                               | Use a directly accessible HTTPS image URL; inaccessible images use the fallback.                                                                           |
| Click totals look incomplete                         | Check enabled/published state, network requests, and the analytics limitations above.                                                                      |
| Interface theme returns to System                    | Browser storage may be blocked or cleared. This affects display preference only, not account or profile data.                                              |
