# Linkboard verification — 13 September 2026

This review covered the dashboard, authentication, profile publishing, public links, QR generation, analytics, account isolation, and deployment configuration. The fixes below were checked with isolated test accounts; real user profiles were not edited.

## Bugs fixed

| Problem                                                                            | Result                                                                                                                                                      |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosted requests could wait indefinitely on a stalled connection.                   | Supabase requests now have a timeout, preserve cancellation, and show actionable feedback.                                                                  |
| Browsers blocking BroadcastChannel could report a successful sign-in as a failure. | Cross-tab notifications are optional; focus-based session checks remain available.                                                                          |
| Middle-button navigation was missing from analytics.                               | Middle-clicks count once; right-click menus do not increment counts.                                                                                        |
| Expired email-confirmation links lost their error during the login redirect.       | A safe error marker survives the redirect, and a manual resend action validates the email and uses a cooldown.                                              |
| Analytics totals used a rolling time window while the chart used calendar days.    | Both use the same local calendar-day boundaries; future or invalid timestamps are excluded from the chart.                                                  |
| An unfinished add-link dialog could survive a change of account.                   | Account changes clear dialogs, pending link fields, errors, and private data. In-flight results remain guarded against account changes.                     |
| Docker did not receive the configured base path at build time.                     | Docker and Compose now pass `NEXT_PUBLIC_BASE_PATH`, preserving prefixed routes and share URLs.                                                             |
| Supabase rejected valid fully qualified hostnames accepted by the form.            | A narrow, repeatable migration accepts a trailing DNS root dot and retains URL safety checks and ownership restrictions. Applied to the configured project. |

## Verification results

- 186 automated tests passed, including actual PostgreSQL RLS checks in isolated PGlite, SQLite authentication/ownership checks, URL validation, hosted-client error handling, and calendar analytics.
- ESLint and TypeScript checks passed.
- The production server build and configured GitHub Pages static export passed.
- Production HTTP checks passed for registration, login, unpublished profiles, account isolation, click tracking, persistence across restart, and session revocation.
- Browser checks covered the login page, dashboard, mobile navigation, light/dark appearance, QR PNG output, public enabled-link filtering, adding and saving an email link, 7/30-day analytics, middle-click counting, and right-click exclusion. Publishing, saving private drafts, input errors, and sticky mobile controls were also verified during the preceding Publish-button change.
- The live Supabase project responded successfully, required email confirmation, and denied anonymous raw access to profiles and analytics. The URL migration's acceptance/rejection checks passed on the live database.
- `npm audit` reported zero known dependency vulnerabilities at review time.

## Remaining setup and verification limits

Public registration still needs a configured SMTP sender. Email verification remains enabled. Delivery to arbitrary new users cannot be verified until the sender is connected; no verification settings were weakened and no test emails were sent to real users.

Docker configuration was reviewed, but a container could not be run because Docker is unavailable in this environment. QR image generation and URLs were inspected; a physical-device scan was not performed. This review is not a guarantee against every possible browser, traffic pattern, or future dependency vulnerability.

## Image uploads and WhatsApp update — 13 September 2026

- Added device uploads for profile pictures and backgrounds, framing controls, background dimming, and an optional dashboard background. WhatsApp links accept international phone numbers or existing WhatsApp HTTPS links.
- 259 automated tests passed. Coverage includes image headers and dimensions, upload limits, account switching during uploads, private image ownership, publication visibility, Supabase RLS, and repeatable migration upgrades.
- ESLint, TypeScript, the production server build, and the configured GitHub Pages export passed.
- Production HTTP checks passed for image upload authentication, owner-header mismatches, unpublished/private reads, published reads, removal and unpublishing, persistence across restart, and existing account/link behavior.
- Browser checks with disposable local accounts verified PNG uploads and resizing, replacement, invalid-file feedback without losing the saved image, background position, the dashboard checkbox, saving and public rendering, WhatsApp number conversion, and readable dark-mode controls. The image editor fit a 375-pixel viewport without horizontal overflow.

The hosted project successfully applied `202609130002_profile_images.sql` on 13 September 2026. Live verification confirmed the Storage operation helper exists, all three existing profiles remain, the appearance column and owner update permission are present, the image bucket is private with a 2 MiB WebP limit, all four image policies exist, and the public profile function includes appearance data. The database is ready for the image-enabled Pages deployment.
