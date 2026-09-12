# Linkboard

A small, self-hostable link-in-bio app built with Next.js, React, TypeScript, Supabase, and the open-source `qrcode` package. Each account owns one profile with an individual `/u/username` address. The dashboard edits the profile, links, appearance, QR code, and click analytics through forms.

The repository runs immediately in an explicitly labeled, local-only demo. Add Supabase configuration for real authentication, separate accounts, durable data, and public pages that work across devices.

## Run locally

Use Node.js 22 and npm.

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No credentials are needed for the demo. The demo stores edits and clicks in this browser's localStorage; clearing site data resets them. Another browser or device cannot see your local demo edits. It is a product preview, not a security boundary or a production account system.

For a reproducible install after the lockfile exists, use `npm ci`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build the production application |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Check TypeScript |
| `npm test` | Run the automated tests |

## Enable accounts and persistent profiles

1. Create a Supabase project, or run your own Supabase instance.
2. Open the project's SQL editor and run the complete [`supabase/schema.sql`](supabase/schema.sql). This creates the tables, access policies, constraints, and public profile/click-recording functions required by the app. Do this before allowing registrations. Keep the `private` schema out of Supabase's exposed API schemas; the app calls only the intentionally exposed wrappers in `public`.
3. Copy [`.env.example`](.env.example) to `.env.local`. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` using your project's URL and public anon/publishable key. You can alternatively put the public key in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, which takes precedence when both key variables are set. Never use a service-role or secret key: browser configuration is public.
4. For a deployed site, set `NEXT_PUBLIC_SITE_URL` to its final origin, such as `https://links.example.com`. Use an origin only, with no `/u/...` path. When it is omitted, the app uses the browser origin.
5. In Supabase **Authentication → URL Configuration**, set **Site URL** to the site origin. Add the app's local and production callback URLs to the allowed redirects: `http://localhost:3000/`, `http://localhost:3000/login`, `https://links.example.com/`, and `https://links.example.com/login`. The current signup flow returns the confirmation session to `/`. If you enable deployment previews, allow only the preview patterns you control. Supabase explains [redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls).
6. Enable the email/password provider in Supabase. Keep email confirmation enabled for a public deployment, and configure a production SMTP sender in Supabase for reliable delivery. Restart `npm run dev`, or rebuild and redeploy after changing environment variables.
7. Visit `/login`, choose account creation, and register with a password of 12–128 characters. Confirm your email if Supabase requires it, then sign in. The database creates the new account's initial profile automatically. Use a second email address to create another independent account.

All accounts use the same Supabase project; you do not need one project per user. A username is unique across the installation. Changing a username also changes its public URL, so regenerate any printed or shared QR code afterward.

`NEXT_PUBLIC_` configuration is embedded when Next.js builds the browser bundle. Setting it only when an already-built container starts will not change the frontend configuration. See [Next.js environment variables](https://nextjs.org/docs/pages/guides/environment-variables).

## Customize and share

Sign in and open `/` for the dashboard. Update your name, biography, avatar, and username in the profile editor. Add social links with a label, a platform, and a destination URL; enable or disable individual links. Use the appearance controls to choose a theme or a custom background color. Save your changes before sharing.

Link destinations accept absolute `https://` and `http://` URLs, plus a single-address `mailto:` URL without extra parameters. Scripts, embedded data, relative destinations, credential-bearing URLs, and malformed addresses are rejected. Avatar URLs must use HTTPS. If an image cannot load, the profile displays a fallback avatar.

Publish the profile to make `/u/username` available to visitors. Unpublished profiles are unavailable to the public. Preview and open the public page to check the result, including mobile layout.

The sharing view renders a QR code and offers a PNG download. Visitors can also display and download the profile QR on the public page. The QR encodes the canonical site origin plus `/u/username`. With no configured origin it uses the currently open site's origin. A QR generated on localhost will point to localhost and cannot be used by other devices over the internet. Generate the final image after deployment, and scan it once on another device before printing it.

## Authentication and data isolation

Supabase Auth handles passwords and issues the user's session. The client maintains that session and restores it on subsequent visits. The dashboard checks the session before loading account data. Signing out clears the current session from the application.

The actual access boundary is Postgres row-level security (RLS) and restricted database grants, not the dashboard's visibility. Raw profile reads and writes require the authenticated user's ID to match the owner. Other visitors use the `get_public_profile` function, which returns only a published profile's public fields and enabled links; disabled links are not sent to visitors. Analytics reads are restricted to the owner. No service-role key is needed by the app, and passwords are never stored in profile records or managed by Linkboard.

Because sessions are used in the browser, avoid untrusted scripts on the same origin and keep dependencies current. A public profile is intentionally public; do not put private contact details in its fields. The avatar is loaded from the URL you provide, so that image host receives normal image requests from visitors.

## Click tracking and analytics

Each enabled public link remains a normal clickable anchor. Its client-side click handler records the link ID without blocking navigation. A tracking failure does not prevent the visitor reaching the destination.

In configured mode, the client submits the click to the Supabase recording function. The database checks that the profile is published and the link is enabled, then creates the event with a server timestamp. Only the profile owner can read those events. No IP address, cookie identifier, or visitor fingerprint is recorded by the app. In demo mode, events and timestamps live only in localStorage on the current browser, with the latest 10,000 events retained.

Open **Analytics** in the dashboard to see click totals per link and timestamp information. Consecutive clicks on the same link within 750 milliseconds are suppressed in the current page. The dashboard paginates database reads so it does not stop at Supabase's default response limit. These are recorded clicks, not unique visitors or guaranteed traffic counts. Repeated clicks and bots can inflate totals; blocked JavaScript, network failures, and opening through a browser context menu can miss events. The public endpoint is intended for basic analytics, and is not a billing or fraud-resistant counter. For a high-traffic public installation, add gateway rate limits, monitoring, and a retention policy appropriate to your usage. A database aggregate query is preferable to downloading all events once analytics grows substantially.

## Deploy

The app is ready for a Next.js host or a Node/Docker server. It needs a live Supabase endpoint in configured mode. The code itself has no paid dependency; free hosting and database plans have provider quotas and are not an unlimited hosting guarantee.

### Vercel

1. Push the repository to your Git provider and import it into Vercel as a Next.js project.
2. Add the project URL, one public key, and site URL from `.env.example` before the build. Set the canonical URL once you know your production hostname.
3. Deploy, update Supabase Site URL and redirect allowlists, and redeploy if the public environment values changed.
4. Register a user, save and publish a profile, open its URL in another browser, and test the downloaded QR.

Vercel's free Hobby plan is restricted to personal, non-commercial use. Check its [Hobby plan](https://vercel.com/docs/plans/hobby) and [fair-use terms](https://vercel.com/docs/limits/fair-use-guidelines) for your use case.

### Netlify

Import the Git repository, let Netlify detect Next.js, use `npm run build`, and retain its Next.js adapter settings. Add the public environment variables before building, then configure Supabase redirect URLs for the resulting hostname. Netlify documents [Next.js deployment support](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/).

Netlify offers a free plan with a hard monthly usage limit; reaching the limit can pause sites until the next cycle. Review the current [pricing and limits](https://www.netlify.com/pricing/). Supabase also offers a free plan with limits and may pause inactive projects; see [Supabase pricing](https://supabase.com/pricing).

### Self-host with Node or Docker

For a Node server, install dependencies, create `.env.local`, run `npm run build`, and then `npm start`. Put a TLS reverse proxy in front of port 3000 and run the process with your service manager. Back up your database separately from the application.

The included Dockerfile uses Next.js standalone output and a non-root runtime user. Set the public build arguments to your own values. The following shell example uses environment variables already set in your terminal:

```sh
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --build-arg NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" \
  -t linkboard .
docker run --detach --restart unless-stopped --name linkboard -p 3000:3000 linkboard
```

In PowerShell, use `$env:NEXT_PUBLIC_SUPABASE_URL` and equivalent names, and place the build command on one line or use PowerShell line continuation. Only public browser values belong in these build arguments.

To own the entire stack, follow the official [Supabase Docker self-hosting guide](https://supabase.com/docs/guides/self-hosting/docker), run `supabase/schema.sql` against that instance, and point Linkboard at its public HTTPS API endpoint. The frontend Dockerfile does not provision Supabase. Self-hosting requires your own compute, TLS, email delivery, updates, database backups, and monitoring; it does not guarantee free infrastructure. Supabase documents these [operational responsibilities](https://supabase.com/docs/guides/self-hosting).

### GitHub Pages and plain static hosts

This repository is not configured for static export. New `/u/username` routes are created after deployment, so a Next.js server/adapter handles routing. Uploading `.next` to GitHub Pages will not work. Supporting a static-only host would require a routing redesign or rebuilding every profile route when users change; use Vercel, Netlify's Next.js adapter, or the included Node/Docker deployment for this version.

## Verify before a public launch

Run:

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

The automated suite covers URL/profile validation, corrupted browser data, storage failures, incomplete configuration, and authentication/data access behavior using a mocked Supabase client. It also runs the actual schema and SQL authorization tests in [PGlite](https://pglite.dev), PostgreSQL compiled to WebAssembly. These database tests switch between anonymous and authenticated roles and verify ownership, draft/disabled-link privacy, click permissions, server timestamps, validation, and safe schema reapplication. They use a minimal substitute for Supabase's managed `auth.users` table and `auth.uid()` helper; they do not test Supabase Auth, email delivery, PostgREST, or your deployed project's configuration.

Also run [`supabase/tests/rls.sql`](supabase/tests/rls.sql) in a development Supabase SQL editor after the schema to check the installed database. It creates temporary test accounts inside a transaction, performs the same authorization assertions, and rolls back the fixtures. It raises an exception on a failing assertion. `npm test` executes this script in an isolated embedded PostgreSQL database; it has not been executed against your deployment automatically.

Then run this browser integration check on your configured project:

1. Register users A and B in separate browser profiles. Set different profile names and links, and verify each account restores its own edits after signing out and back in.
2. Publish A. While signed out, verify its public profile loads. Unpublish it and verify a fresh signed-out request cannot load its profile or links.
3. As B, use the browser's Supabase client/API with B's session to attempt an update or delete of A's profile ID. Verify the database does not change A's row; an RLS-blocked operation may affect zero rows rather than return an error.
4. As B and as an anonymous client, query A's click events. Verify B sees no events and anonymous direct access is denied. Anonymous raw profile reads and updates must also be denied. The public lookup must include enabled links only, even when a disabled link exists in the owner's dashboard.
5. Click an enabled link on A's published page while signed out. Verify A sees the event with a timestamp, B cannot see it, and an unknown/disabled link cannot create an event.
6. Test an expired session, a disconnected network, an unavailable image, a duplicate username, and invalid URL input. Confirm errors are readable and unsaved changes are not mistaken for a successful save.
7. Open the deployed public page on mobile and scan the downloaded QR from another device. Verify the QR contains the final public address.

Keep the SQL and app version together when deploying. Review the database and auth logs if an integration check fails; do not disable RLS to work around it.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| The app shows demo mode after deployment | The public Supabase URL and one public key must be set at build time; rebuild after adding them. |
| Login works but saving fails | Run the entire schema, verify the project's URL/key pair, and inspect the surfaced error. |
| Confirmation email returns to localhost | Update Supabase Site URL and allowed redirect URLs for production. |
| A public profile is missing | Check spelling, publishing state, network access, and whether the Supabase project is paused. Local demo edits do not propagate to other devices. |
| QR points to an old domain | Correct `NEXT_PUBLIC_SITE_URL`, rebuild, then download the QR again. |
| Avatar does not appear | Use a directly accessible HTTPS image URL; the fallback avatar is expected for inaccessible images. |
| Click totals look incomplete | Check the network, enabled link state, and analytics limitations above. Demo data is browser-local. |
| Local demo changes disappear | Private browsing, blocked storage, or clearing site data can remove localStorage. Configure Supabase for durable data. |
