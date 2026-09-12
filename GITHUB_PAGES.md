# GitHub Pages: interactive demo or QMC website

For the full signup/login platform, use the Cloudflare + Supabase setup in [README.md](README.md). GitHub Pages hosts the browser-only demo or an exported public page.

## Publish the Linkboard demo from this repository

The committed `docs/index.html` contains the whole demo, including its styles, motion helpers, and QR encoder. No package install or build service is required to publish it.

1. Open **Settings → Pages** in `20SHA07/linkboard`.
2. Choose **Deploy from a branch**, **main**, and **/docs**, then **Save**. If Pages already uses **main / (root)**, that also works: the root entry page opens the demo in `docs/`.
3. Wait for **pages build and deployment** to complete in Actions, then use **Visit site**. The project address is `https://20sha07.github.io/linkboard/`.

Future interface edits require `npm run pages` with Node.js 24+, then committing the regenerated `docs/index.html`. GitHub serves the committed output. `npm run demo` separately refreshes the downloadable `linkboard-demo.html`.

The demo is labelled as such. Each visitor edits their own browser-local copy; changes are not shared, accounts are unavailable, and there are no live analytics. Use Settings to download a backup or website. Clearing browser storage can remove local edits.

## Publish QMC's finished page

GitHub Pages can serve the exported QMC website for free from a public repository. It serves static HTML, CSS, and JavaScript. The exported page includes its images, light/dark modes, active social links, and on-page QR code and sharing menu in one file.

The private server editor, user accounts, database, and view/click counts need the Node or Cloudflare version. Use the downloaded editor to make changes, then upload each new website export to GitHub.

## 1. Finish your page

Open the supplied `linkboard-demo.html` in your browser. If you only have the source project, install Node.js 24+, open a terminal in the `linkboard` folder, and run `npm run demo` to generate that file.

- Add QMC’s real social addresses and switch on the links you want visible.
- In Appearance, customize your design. Under **Light, dark, or both**, choose the default page mode and whether visitors can change it.
- Under **Your palette & background → Customize dark colours**, edit the dark palette if you want.
- Use the preview selector to check Light and Dark. The editor’s top mode selector changes the workspace, while the page setting changes what visitors see.
- In Settings, select **Download backup** to keep an editable JSON copy, then select **Download website**. At least one valid link must be enabled.
- Rename the exported `qmc.html` to `index.html`.

## 2. Create a public repository

Sign in to GitHub and create a repository, for example `qmc-links`. Choose **Public** to use GitHub Pages with GitHub Free. Adding a README is optional.

Upload the exported **index.html** at the repository’s top level and commit it to `main`. The exported file already contains its required assets. You do not need to upload the application’s source folders, private keys, database, or page backups.

Optional: create an empty `.nojekyll` file alongside `index.html` to explicitly skip Jekyll processing.

## 3. Enable Pages

1. Open the repository’s **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select **main** and **/ (root)**, then **Save**.
4. Wait for the deployment to finish. GitHub says publishing can take up to 10 minutes.
5. Open **Visit site** from the Pages settings. A project repository named `qmc-links` uses the path `/qmc-links/` on your account’s `github.io` site.

The export works under a repository path because it has no root-relative script or stylesheet dependencies. Social links go directly to their destinations.

## 4. Get the QR code

Open the published page at its final HTTPS address, download the QR from the page itself or its share button. Scan it with your phone before printing.

The QR code uses the address you opened, including the GitHub repository path. Keep the same repository and page address when you update the site so existing QR codes keep working.

Enable either the on-page QR code or the share button in Appearance, then export. They are independent controls.

## 5. Make future edits

Open the same downloaded editor, or import your JSON backup if your browser data has been cleared. Make your changes and export again. Replace **index.html** in the same repository and commit to `main`; Pages publishes that updated file.

Website exports are snapshots. Editing the browser editor does not automatically update GitHub, and visitors cannot edit QMC’s links. Browser mode preferences are local to each visitor and separate from your editor mode. With System selected, appearance follows the visitor’s device; manual Light or Dark choices override it until changed.

## Cost and limits

GitHub Pages is currently included for public repositories on GitHub Free. A provided `github.io` address avoids buying a custom domain. Hosting remains subject to GitHub’s usage limits and terms; permanent free service is not guaranteed.

Sources, checked September 12, 2026: [What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Creating a Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site), and [Configuring the publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
