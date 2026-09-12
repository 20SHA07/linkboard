# Linkboard

A complete private link-in-bio workspace. Create pages, customize their design, publish, and download a QR code. A QMC draft is included as your first page.

The application has no paid SDKs, external fonts, analytics services, or runtime npm dependencies. You control the code and the data. It has one private owner workspace and multiple public pages. Separate accounts, public registration, and team permissions are not included.

## Run it locally

Install **Node.js 24 or newer**, unzip this project, and open a terminal in the `linkboard` folder:

```bash
npm start
```

Open `http://127.0.0.1:3000`. In another terminal, run:

```bash
npm run owner-key
```

Paste that key into the sign-in form. It is generated on first start, kept in `.data/admin-key`, and never included in the public site. Keep it private: anyone with it can edit every page in this workspace. Sessions last seven days, and signing out revokes the current session.

The local database is `.data/linkboard.sqlite`. Keep the `.data` folder between runs. Stop the server before copying the folder for a full local backup. The default server listens only on your computer; it is not a public hosting service.

## Finish the QMC page

1. Select **QMC** in the page picker.
2. Click its avatar to upload the real QMC logo. Set the name and description.
3. Paste the real social URLs into the prepared link cards, then switch on the links you want visible. Add or remove platforms as needed.
4. Open **Appearance** for themes, colours, backgrounds, typography, spacing, buttons, and custom CSS. Use **Link details → Style this link** for individual link designs. Linkboard credit is optional and off by default.
5. Use **Save draft** while working. When at least one valid link is enabled, select **Publish page**.
6. On the hosted app, open **QR & sharing** and download an SVG for print or a PNG for other uses. Scan the code on your phone before printing copies.

QMC’s address will be `/p/qmc` on your chosen host. Published addresses stay fixed, including when a page is unpublished, to protect shared links and printed QR codes. Updating a social destination does not change the QR code. Deleting a page, changing its domain, or shutting down its hosting makes its old QR code stop working.

The supplied QMC draft contains no invented handles. Empty or disabled links never appear on the public page. Public pages work without JavaScript; JavaScript adds the share dialog and QR download.

## Host it on Cloudflare’s free tier

You need your own Cloudflare account. Keep the account on **Workers Free**. From the project folder, run:

```bash
npm run deploy
```

The helper signs you into Cloudflare, asks for a Worker name, creates a D1 database, applies the schema, and deploys the app with the owner key stored as a Worker secret. It uses the current Wrangler 4 CLI and requires internet access. `wrangler.jsonc` is created for your deployment. Reuse this file on later deployments to keep the same Worker and database.

After deployment, open the HTTPS address printed in the terminal. Run `npm run owner-key` and paste the key into the hosted editor. The provided `workers.dev` address avoids buying a domain. Keep **Workers Free** selected and leave paid products disabled. The helper does not upgrade your plan.

Current free limits, checked September 12, 2026:

| Resource | Free allowance |
| --- | --- |
| Dynamic Worker requests | 100,000 per day across the account |
| Worker CPU | 10 ms per invocation |
| D1 rows read | 5 million per day |
| D1 rows written | 100,000 per day |
| D1 database size | 500 MB per database; 5 GB across the account |
| Static asset requests | Free and unlimited |

A page visit, a link redirect, and an editor API call each use dynamic requests. These are not allowances for 100,000 complete visitor sessions. D1 daily read/write exhaustion returns errors until the limits reset; it does not provide unlimited service. Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), and [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

**Free forever:** this copy of Linkboard is MIT-licensed with no subscription or feature fees. Third-party hosting terms, service availability, and your usage can change, so nobody can guarantee permanent $0 hosting. Keep the source and page backups so you can move the app. A bought custom domain normally has a renewal cost; use a host-provided address for a $0 setup.

Configure QMC in the **hosted** workspace to create its shareable URL. Local and hosted databases are separate. To move a page you already edited locally, download its backup in Settings and import it on the hosted workspace. For the exact `qmc` address, first delete the untouched hosted QMC draft, then import the backup using `qmc`.

If automated setup stops, use the manual commands below. Copy `wrangler.example.jsonc` to `wrangler.jsonc`, change the Worker name, and replace its database ID with the ID printed by `d1 create`.

```bash
npx wrangler@4 login
npx wrangler@4 d1 create linkboard-db
npx wrangler@4 d1 migrations apply DB --remote
npx wrangler@4 deploy
npx wrangler@4 secret put ADMIN_KEY
```

Paste a random owner key of at least 32 characters at the secret prompt. Before that secret is configured, the workspace rejects sign-in. Reference: [D1 commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/) and [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

If you later add a custom domain, set the Worker variable `PUBLIC_ORIGIN` to its HTTPS origin, without a path. Keep using that domain for printed QR codes. Do not set it to a guessed or unconfigured address.

## Host the exported QMC website on GitHub Pages

GitHub Pages supports the single-file website export, including Light, Dark, and System modes. Use a public repository for GitHub Free. Build your page in the downloaded editor, select **Settings → Download website**, rename the result to `index.html`, upload it to the repository root, and choose **Settings → Pages → Deploy from a branch → main → / (root)**.

The full step-by-step guide is [GITHUB_PAGES.md](GITHUB_PAGES.md). Future edits require exporting again and replacing `index.html` in the same repository. GitHub Pages serves the public website; the app’s private owner authentication and database still require the Node or Cloudflare version. GitHub’s [Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) describes its static hosting and free public repository support.

## A simpler free route on Cloudflare Pages

If you are happy to edit in the downloaded browser editor and upload each finished version, you can host the exported QMC page as a static website. This route has no application server or database.

1. Open `linkboard-demo.html` in your browser, enter the real QMC links, and customize its appearance.
2. In **Settings**, download a **page backup** to keep editable data. Then select **Download website**.
3. Rename the exported `qmc.html` to `index.html` and place it in a folder called `qmc-site`.
4. In Cloudflare, open **Workers & Pages → Create application → Get started → Drag and drop your files**. Give the Pages project a name, upload the `qmc-site` folder, and deploy it.
5. Open the production `pages.dev` address. If the share button is enabled, use it to download the QR code for this address. Scan it before printing.
6. To change a link or design later, edit the browser editor, export again, and create a new **production deployment in the same Pages project**. Keeping the address unchanged keeps printed QR codes useful.

Cloudflare Pages currently serves static requests free and without a request quota. Build, file, and other platform limits still apply. The exported site is a single HTML file containing its styles, uploaded images, active links, and optional QR share menu. It does not include the private editor, online saving, or analytics. Sources: [Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/) and [Direct Upload instructions](https://developers.cloudflare.com/pages/get-started/direct-upload/).

The demo stores edits in this browser when storage is available. Moving the demo file, clearing browser data, or reaching storage limits can remove that convenience. The JSON page backup is the portable editable copy. A website export does not automatically receive future changes from the editor.

## Design controls

Start with one of six palettes, then change any of these without a subscription:

| Area | Controls |
| --- | --- |
| Display mode | Light, Dark, or System; optional visitor selector; separate editor preference; light/dark preview |
| Colours | Separate light and dark palettes: background, main and secondary text, buttons, accents, borders, per-link colours |
| Background | Solid, two-colour gradient, angle, uploaded image, overlay, dots or grid |
| Identity | Name, bio, profile image, cover image, image sizes, shape, border, alignment |
| Typography | Five device font stacks, separate heading font, sizes, heading weight and letter spacing |
| Layout | Single column or grid, maximum width, side margins, section spacing, link spacing |
| Buttons | Filled, outline or glass; corner radius, border width, padding, shadows and motion |
| Individual links | Icon, description, visibility, ordering, colours, featured border, badge and thumbnail |
| Finishing touches | Top label, share button, icons, arrows, descriptions, footer, note and optional credit |
| Advanced | Custom CSS for the public page, mobile preview, expanded preview, reset controls |

Images are resized in the browser and stored with the page. Upload PNG, JPEG, or WebP files up to 12 MB; the saved page and its images must fit within 1.8 MB. The editor compresses uploads automatically. CSS is limited to 18,000 characters. HTML, JavaScript, stylesheet imports, and external image/font resources are not supported in custom CSS. This gives broad visual control without allowing CSS to affect the private editor. These limits apply to the included editor; the MIT source can be modified if you need different functionality.

The editor mode selector changes only your workspace. **Appearance → Light, dark, or both** controls the default public page mode; visitors can choose their own if you enable the selector. Choices are remembered in each browser when storage is available. System mode follows device appearance changes. Mode settings travel with page backups and HTML exports, and custom CSS can target `:root[data-mode="dark"]` or the `prefers-color-scheme` media query. Explicit per-link colours remain as chosen in both modes.

## What’s included

- Multiple pages, an owner sign-in, and persistent SQLite/D1 storage.
- The full design studio above, including per-link styling and custom CSS.
- Up to 100 links per page, optional descriptions, social icons, visibility switches, drag ordering, and accessible up/down controls.
- Draft saves, publishing, unpublishing, and protected page deletion.
- Public HTML pages, native sharing, clipboard fallback, and locally generated SVG/PNG QR exports.
- Optional anonymous daily view/click counts, a 30-day view, and CSV export. Counts are not unique visitors and may include automated traffic. Do Not Track and Global Privacy Control requests are excluded.
- Standalone website export, page backup/import, and duplication. A page backup contains content and design; it does not include analytics or sessions.
- Concurrent-edit protection, input validation, parameterized SQL, CSRF checks, rate-limited sign-in, secure production cookies, and security response headers.

To rotate the hosted owner key, run `npx wrangler@4 secret put ADMIN_KEY`. Old sessions stop working immediately. For local use, replace `.data/admin-key` while the server is stopped, then restart. There is no email-based password recovery or public signup.

## Verification

```bash
npm test
```

The 30 automated checks cover authentication, authorization, CSRF checks, publishing, unsafe input and CSS, concurrent updates, analytics, design and image persistence, backup/import, portable HTML export on GitHub project paths, mode persistence and device changes, database upgrades, deletion, link batches, and actual persistence across local server restarts. The QR encoder was also compared against an independently installed QR encoder during development.

Browser rendering and interaction checks, and an actual Cloudflare deployment, could not be run in the build environment. Check the hosted page on a phone before public use. The standalone `linkboard-demo.html` is an offline editor using browser storage. It exports a deployable website, but does not publish that file to the internet itself.

## Project files

`src/worker.mjs` contains the production API and public-page routes. `src/local.mjs` runs the same app locally, and `src/db.mjs` adapts SQLite to the D1 interface. `public/` contains the editor and shared page renderer. `migrations/` defines and upgrades the database, and `test/` contains integration checks. To rebuild the standalone editor, run `npm run demo`. Version 1.2 adds Light/Dark/System modes using the existing design field, so it needs no new database migration. Version 1.1 adds design storage through `0002_design_studio.sql`; local startup and the deployment helper apply pending migrations without reseeding edited pages.

Application code is provided under the MIT license. Preserve the third-party QR encoder notices when redistributing the project.
