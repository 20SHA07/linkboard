# Linkboard

A free, self-hostable link page platform. Anyone can create an account, verify their email, and build pages in a desktop design studio. Published pages have their own addresses, light/dark modes, and optional on-page QR codes.

Version 2 adds individual accounts, public registration, password recovery, page ownership, a new public home page, desktop layouts, and moderation. The code is MIT-licensed. There is no paid feature tier in this app. Hosting providers have usage limits; unlimited free hosting forever is not a promise this project can make.

## What you can use

- Email/password signup, email-code verification, login, sign-out, and password recovery.
- Separate private workspaces. An account cannot read, edit, export, or delete another account’s pages.
- Multiple pages per account, draft saves, publishing, duplication, backups, import, and standalone website export.
- A desktop editor with a live 1024px desktop preview, phone preview, and expanded preview.
- Studio, Poster, and Notebook starting layouts; six colour themes; detailed visual controls and custom CSS.
- Light, Dark, and System modes for both the editor and public pages, with separate light/dark palettes.
- QR displayed on the page, optional share dialog, SVG download, and PNG export from the editor. QR generation runs in the visitor’s browser without a QR service.
- Up to 100 links per page with icons, descriptions, badges, thumbnails, individual styling, and drag or keyboard-friendly ordering.
- Optional daily view/click totals, a 30-day display, and CSV export. These are counts, not unique visitors. Do Not Track and Global Privacy Control requests are excluded.
- Public page reports, owner-only review, and reversible page hiding.
- A QMC starter draft with empty social URLs. No handles or logos are invented.

This is a working core alternative, not a complete copy of every Linktree product. Shared team editing, Google/social login, MFA screens, shops/payments, email marketing, per-user custom-domain provisioning, and automated account deletion are not implemented. Account deletion requests go to the operator. A page has one owning account. These features can be added to the source without a Linkboard licence fee.

## Where each part runs

| Service | Job |
| --- | --- |
| GitHub | Source repository and version history |
| Cloudflare Workers | Website, private API, public pages, and link redirects |
| Cloudflare D1 | Page content, uploaded images, ownership, encrypted sessions, reports, and counters |
| Supabase Auth | Account identity, passwords, email verification, recovery, and token refresh |
| An SMTP provider connected to Supabase | Delivers account verification and recovery emails |
| Cloudflare Turnstile, optional | CAPTCHA on account forms, verified by Supabase |

You do not host the website on Supabase in this setup. You use its Auth service only. There are no application tables or migrations to put in Supabase, and no Supabase Storage, R2, Firebase, Vercel, or paid SDK is needed. D1 is accessed only by the Worker, never directly from the browser. The API enforces account ownership on every private page operation.

GitHub Pages is suitable for an exported public QMC page. The full service needs the Worker API and database. GitHub also discourages Pages use for sensitive transactions such as sending passwords and restricts commercial SaaS hosting. Keep the account service on Cloudflare. See [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) and [GITHUB_PAGES.md](GITHUB_PAGES.md).

## Set up Supabase Auth

1. Create a Supabase project on its Free plan. Use a separate project for Linkboard if possible.
2. In Authentication, enable email/password sign-in, allow new signups, and keep **Confirm email** enabled. Set the minimum password length to 12, matching the app. Additional provider password rules may also apply.
3. In the project’s API settings or Connect dialog, copy the **Project URL** and **publishable key**. A legacy `anon` key also works. Never use `service_role` or an `sb_secret_` key. You do not need to supply your Supabase database password to Linkboard.
4. In **Authentication → Email Templates → Confirm signup**, paste [auth-emails/confirm-signup.html](auth-emails/confirm-signup.html). Use a subject such as “Your Linkboard verification code”.
5. In **Reset password**, paste [auth-emails/reset-password.html](auth-emails/reset-password.html). Use a subject such as “Your Linkboard recovery code”.
6. Both templates must contain `{{ .Token }}`. Linkboard uses numeric codes entered in the browser, not Supabase’s default confirmation-link/URL-fragment flow. Using the unmodified link templates will not complete these account forms.
7. Configure **custom SMTP** with the sender, host, port, username, and password supplied by your email provider. Complete that provider’s sender/domain verification. SMTP credentials belong in Supabase’s dashboard, not the Linkboard repository.
8. Set the Auth **Site URL** to `http://127.0.0.1:3000` while testing, then your actual HTTPS Worker address after deployment. This implementation does not need broad wildcard redirect URLs.

Supabase’s default email sender is intended for testing, currently only sends to project-team addresses, and is limited to two messages per hour. It cannot support public registration for arbitrary users. Custom SMTP is required for launch. Email providers may have free allowances, but volume, sender verification, and domain requirements vary. A provider may require a domain you own, which can prevent an entirely $0 setup if you do not already have one. Sources: [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [Signup OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp), [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

For bot protection, create a Turnstile widget with your actual hostnames, put its **secret key in Supabase Auth’s CAPTCHA settings**, and its **site key in Linkboard’s configuration**. These must be configured together. The site key is public; the secret stays in Supabase. See [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha).

## Configure and test locally

Install **Node.js 24 or newer**. Clone this repository or download and unzip it, then open a terminal in the project folder:

```bash
git clone https://github.com/20SHA07/linkboard.git
cd linkboard
npm run configure
npm start
```

The configure command asks for your Supabase project URL, publishable key, the email you will use as site owner, a support email, and an optional Turnstile site key. It creates a private `.env` and generates a random session-encryption secret. This file is ignored by Git. Do not paste secrets into chat or commit them.

Open `http://127.0.0.1:3000`. Select **Create an account**, use the owner email, enter the emailed code, and create a page. Configure SMTP before testing a non-team address. If CAPTCHA is enabled, your widget must accept your local hostname too.

Local content is in `.data/linkboard.sqlite`; local and hosted databases are separate. Keep `.data` and `.env` between runs. Stop the server before copying `.data` for a local backup. The default server listens only on your computer. Local signup still uses your configured Supabase project, so local and hosted identity are shared if they use the same project.

To try the editor without accounts or hosting, open the supplied `linkboard-demo.html`, or generate it with `npm run demo`. This is explicitly an offline demo. Edits stay in this browser when storage is available. It does not provide public signup, publish to the internet, or create real analytics. Use **Download backup** to keep your editable work.

## Deploy on Cloudflare

Create a Cloudflare account and keep it on **Workers Free**. From the configured project folder:

```bash
npm run deploy
```

The helper uses Wrangler 4, signs you into Cloudflare, asks for a Worker name, creates a D1 database if needed, applies migrations, and deploys the site and API. The Supabase publishable key and session secret are stored as Worker secrets. Public configuration is stored as Worker variables. It does not select or enable a paid plan.

Reuse the generated `wrangler.jsonc`, `.env`, and `.data/admin-key` on future deployments. The helper preserves the existing database ID and upgrades the asset routes. Do not create a new database for each update. If you deploy from another computer, copy these private configuration files securely.

Wrangler prints your real HTTPS `workers.dev` address. The address is only live after a successful deployment. Update Supabase’s Site URL and, if used, Turnstile hostnames to that address. Open `/signup` or `/login` on that host. GitHub pushes by themselves do not run this helper or deploy the site.

A host-provided address avoids buying a website domain. If you add a custom domain later, configure it in Cloudflare and set `PUBLIC_ORIGIN` in `.env` to its actual HTTPS origin, then redeploy. Keep the public domain stable once QR codes are distributed.

Manual fallback:

1. Copy `wrangler.example.jsonc` to `wrangler.jsonc`, change the Worker name, and put your actual public configuration in `vars`.
2. Run `npx wrangler@4 login` and `npx wrangler@4 d1 create linkboard-db`. Put the returned database ID into the existing `DB` binding.
3. Run `npx wrangler@4 d1 migrations apply DB --remote`.
4. Run `npx wrangler@4 secret put SESSION_SECRET` and `npx wrangler@4 secret put SUPABASE_PUBLISHABLE_KEY`, entering the corresponding `.env` values at the prompts. Wrangler can create the Worker when setting its first secret.
5. For an upgrade or the QMC seed claim, set `ADMIN_KEY` using `npx wrangler@4 secret put ADMIN_KEY`. Reuse the original value, never an example key.
6. Run `npx wrangler@4 deploy`.

References: [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [D1 commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/), [static asset routing](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/).

## Finish QMC or upgrade from version 1

Migration `0003_accounts.sql` preserves earlier pages, links, designs, and public addresses. It signs out old workspace-key sessions. Those pages remain unclaimed until a verified account proves possession of the original workspace key. New signups cannot access them automatically.

1. Sign in using your verified owner email.
2. Run `npm run owner-key` on the computer that has the original `.data/admin-key`, or use the `ADMIN_KEY` you originally configured.
3. In the app, select **Account → Bring in an earlier workspace**, then enter that original key. All still-unclaimed pages move into this account once. The key does not grant access to pages already owned by another account.
4. Select QMC, upload its real logo, add its real social URLs, and enable the links you want visible.
5. Customize Appearance, then **Publish page**. The address becomes `/p/qmc` on your host.
6. In **Appearance → A QR code on your page**, choose visibility, position, size, and caption. In **QR & sharing**, download an SVG or PNG. Scan the hosted code before printing.

The first publication locks the address even if you later unpublish. Editing links does not change the QR code. Deleting a page frees its address, so unpublish if you want to retain it. Moving domains or shutting down hosting can break old QR codes.

If you lose an old key, do not claim with a new invented key. A database administrator can assign unclaimed pages to a verified account after checking ownership. Page backups can be imported into a new account with a new address. They never overwrite another user’s page.

## Customize the page

| Area | Controls |
| --- | --- |
| Layout | Stack, grid, or split profile/links; up to 1200px width; margins and spacing |
| Display | Light, Dark, or System; visitor selector; independent editor and preview modes |
| Colour | Separate light/dark palettes, per-link colours, gradient, overlay, dots/grid texture |
| Identity | Name, bio, profile/cover/background images, alignment, avatar size and shape |
| Typography | Five device font stacks, separate heading font, sizes, weight, and letter spacing |
| Links | Icons, descriptions, visibility, order, colours, badge, thumbnail, featured border |
| Buttons | Filled, outline, glass, borders, radii, padding, shadows, hover and entrance motion |
| Sharing | QR visibility, position, size, caption, share button, SVG/PNG exports |
| Details | Labels, note, footer, icons/arrows, descriptions, optional Linkboard credit |
| Advanced | Custom CSS, JSON backups, duplication, and standalone HTML export |

Images are compressed in the browser. Upload PNG, JPEG, or WebP up to 12 MB; each saved page must fit within 1.8 MB including its images. CSS is limited to 18,000 characters. Custom HTML, JavaScript, stylesheet imports, external image resources, and web-font services are not supported. Device fonts vary by computer. Per-link colours remain as selected in both modes, so check their contrast. Custom CSS is powerful enough to hide or overlap your own page controls; use Reset if you get stuck.

QR codes keep black modules and a white quiet zone for scanning. You can style the surrounding card with CSS. Turning off sharing does not turn off the separate on-page QR setting. Public social links work without JavaScript; interactive QR and mode controls need it. Exported pages compute their QR from the final host and repository path.

## Free-tier capacity

Checked September 12, 2026:

| Resource | Free allowance |
| --- | --- |
| Worker dynamic requests | 100,000 per day across your account |
| Worker CPU | 10 ms per invocation |
| Static asset requests | Free and unlimited |
| D1 reads / writes | 5 million rows read and 100,000 rows written per day |
| D1 storage | 500 MB per database; 5 GB across the account |
| Supabase Auth | 50,000 monthly active users |
| Supabase project availability | Free projects pause after one week of inactivity |
| Email delivery | Your chosen SMTP provider’s allowance |

Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Supabase pricing](https://supabase.com/pricing).

These limits are independent. This app uses one D1 database, so its free storage ceiling is 500 MB, not the 5 GB account total. Images use that space. A visit, a redirect click, and an API call each use resources; 100,000 requests does not mean 100,000 full visitor sessions. The Supabase allowance does not prove this installation can serve 50,000 creators. Large pages and exports also need checking against the Worker CPU budget on the deployed host.

D1 rejects queries when daily quotas are exhausted. A service can stop working before it incurs a charge. Keep free plans selected, monitor dashboards, and decide whether to close registration, reduce usage, move hosts, or fund upgrades as the service grows. No implementation can guarantee another company’s pricing or uptime forever.

## Site ownership and maintenance

`OWNER_EMAIL` must match a **provider-verified** email. User-editable metadata cannot grant administrator privileges. The owner can review reports in **Account → Review reports** and restore hidden pages. Moderation hides public pages and redirects while preserving the creator’s private editor. A disabled account cannot edit or publish; its public pages are unavailable.

`MAX_PAGES_PER_USER` defaults to 5 and can be set from 1 to 50 in `.env`. Change it and redeploy. Legacy claims preserve all previous pages even if they exceed the new limit; creating more pages still respects the limit. Set `REGISTRATION_OPEN=false` and redeploy to pause new memberships while existing members can sign in. Also close signups in Supabase if you want to stop direct project registrations. The verified site owner can still establish an app session when registration is closed, provided the Supabase account already exists.

For a verified account deletion request, first confirm the account ID against its Supabase Auth identity. In D1, delete that account’s pages, then its `accounts` row (sessions cascade). Delete the corresponding Supabase Auth user from its dashboard too. The account email and pages are removed from the active app database; provider logs and recovery backups have their own retention. Don’t delete an identity using a guessed email/ID. Put a working `SUPPORT_EMAIL` in your configuration and review the public privacy/community pages for your site.

Keep database exports and the session secret private. A full D1 backup contains account data and encrypted provider credentials. Use D1’s dashboard backup/export tools; per-page JSON exports contain only page information. Rotating `SESSION_SECRET` invalidates all app sessions. Changing `ADMIN_KEY` affects legacy claims only. Never put production secrets in `public/`, GitHub, page CSS, or a website export.

Before inviting everyone, use the real host to register two separate accounts, verify SMTP delivery, complete recovery, publish a page, check its QR on a phone, and inspect desktop/mobile plus light/dark layouts. Turnstile, if configured, must pass with the actual domain. Review free-plan metrics after representative uploads and exports.

## Verification and project layout

```bash
npm test
```

The automated suite covers signup/verification contracts, ownership across every private page endpoint, session encryption/revocation/refresh, recovery restrictions, registration closure, rate limits, CSRF, reporting, page quotas under concurrency, publishing, imports, unsafe input/CSS, design persistence, QR host paths, colour modes, schema upgrades, and an actual local server restart.

Supabase responses are mocked in integration tests; real SMTP delivery, provider configuration, CAPTCHA, Cloudflare deployment, production CPU limits, and visual browser interaction were **not** verified in the build environment. The browser installation was unavailable. These are deployment acceptance checks, not claims that the hosted service is already live.

- `src/worker.mjs`: production routes and page ownership.
- `src/auth.mjs`: Supabase Auth REST integration and encrypted server sessions.
- `src/local.mjs` / `src/db.mjs`: local Node server and D1-compatible SQLite adapter.
- `public/`: landing page, account forms, studio, public renderer, QR and sharing.
- `migrations/`: incremental D1/SQLite schema updates.
- `auth-emails/`: code-based templates to paste into Supabase.
- `scripts/`: local configuration, deployment, and offline-demo build.
- `test/`: integration and export checks, with a test-only Auth provider double.

No runtime npm dependencies or externally loaded fonts are required. Preserve [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the bundled QR encoder when redistributing this project.
