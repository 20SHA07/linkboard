import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, Database, Link2 } from 'lucide-react';
import ThemeToggle from './theme/toggle';
import QRCode from './qr-code';
import { needsBackendSetup, hasSupabaseConfiguration } from '@/lib/backend-config';
import { appPath } from '@/lib/urls';

const repository = 'https://github.com/20SHA07/linkboard';

function deployedAddress() {
  try {
    const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || '');
    if (origin.protocol !== 'https:' || origin.username || origin.password) return '';
    return new URL(appPath('/'), origin.origin).href;
  } catch {
    return '';
  }
}

export default function SetupGuide() {
  const address = deployedAddress();
  return (
    <div className="setup-shell">
      <header className="setup-header">
        <Link href="/" className="setup-brand" aria-label="Linkboard home">
          <Link2 size={25} aria-hidden="true" /> linkboard<span aria-hidden="true">.</span>
        </Link>
        <nav aria-label="Setup navigation">
          <ThemeToggle />
          <Link href="/login/" className="setup-signin">
            Sign in <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <main className="setup-main">
        <section className="setup-intro" aria-labelledby="setup-heading">
          <span className="setup-kicker">A LITTLE SPACE FOR EVERYTHING YOU DO</span>
          <h1 id="setup-heading">
            {needsBackendSetup ? 'Your space is online.' : 'Make yourself at home.'}
          </h1>
          <p>
            {needsBackendSetup
              ? 'One connection to go. Set up Supabase to bring your account, links, and audience together.'
              : 'Connect your account backend, then make a page that feels like you. This guide is for the site owner.'}
          </p>
          <div className="setup-status">
            <span>
              <Check size={15} aria-hidden="true" /> Website available
            </span>
            <span>
              <Database size={15} aria-hidden="true" />{' '}
              {hasSupabaseConfiguration ? 'Backend settings added' : 'Supabase setup pending'}
            </span>
          </div>
        </section>

        <div className="setup-layout">
          <section className="setup-instructions" aria-labelledby="connection-heading">
            <div className="setup-section-heading">
              <span className="setup-kicker">FOR THE SITE OWNER</span>
              <h2 id="connection-heading">Connect once. Make it yours.</h2>
              <p>
                GitHub Pages serves the website. Supabase stores accounts, profiles, and click
                history.
              </p>
            </div>
            <ol className="setup-steps">
              <li>
                <details open>
                  <summary>
                    <span className="setup-step-number">01</span>
                    <h3>Create your Supabase project</h3>
                  </summary>
                  <div className="setup-step-body">
                    <p>
                      Open Supabase, create a project on its free plan, choose a region, and save
                      your database password privately. Wait for the project to finish starting.
                    </p>
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Supabase <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                  </div>
                </details>
              </li>
              <li>
                <details>
                  <summary>
                    <span className="setup-step-number">02</span>
                    <h3>Prepare your database</h3>
                  </summary>
                  <div className="setup-step-body">
                    <p>
                      In the project, open <strong>SQL Editor → New query</strong>. Copy the entire
                      schema file below, paste it into the editor, and choose <strong>Run</strong>.
                      It creates profiles, analytics, and the access rules that keep users separate.
                    </p>
                    <a
                      href={`${repository}/blob/main/supabase/schema.sql`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open the database schema <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                    <p>
                      Keep the Data API enabled with the <code>public</code> schema exposed. Leave
                      the <code>private</code> schema unexposed. Never disable row level security.
                    </p>
                  </div>
                </details>
              </li>
              <li>
                <details>
                  <summary>
                    <span className="setup-step-number">03</span>
                    <h3>Set up email and redirects</h3>
                  </summary>
                  <div className="setup-step-body">
                    <p>
                      Enable email/password under{' '}
                      <strong>Authentication → Sign In / Providers</strong>. Under{' '}
                      <strong>URL Configuration</strong>, set Site URL to:
                    </p>
                    <code className="setup-code">https://20sha07.github.io/linkboard/</code>
                    <p>Add both allowed redirect URLs:</p>
                    <code className="setup-code">
                      https://20sha07.github.io/linkboard/
                      <br />
                      https://20sha07.github.io/linkboard/login/
                    </code>
                    <p>
                      Keep email confirmation enabled for public registration. Configure{' '}
                      <strong>Authentication → Email → SMTP Settings</strong> with an email
                      provider: Supabase’s default sender restricts delivery to project team
                      addresses. Public users need a configured sender to confirm their accounts.
                    </p>
                    <a
                      href="https://supabase.com/docs/guides/auth/auth-smtp"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Email setup instructions <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                  </div>
                </details>
              </li>
              <li>
                <details>
                  <summary>
                    <span className="setup-step-number">04</span>
                    <h3>Add your public connection settings</h3>
                  </summary>
                  <div className="setup-step-body">
                    <p>
                      In Supabase’s <strong>Connect</strong> dialog, copy the project URL and
                      publishable key. In this repository’s{' '}
                      <strong>Settings → Secrets and variables → Actions → Variables</strong>,
                      create these two repository variables:
                    </p>
                    <dl className="setup-variables">
                      <dt>
                        <code>NEXT_PUBLIC_SUPABASE_URL</code>
                      </dt>
                      <dd>Your project’s HTTPS URL</dd>
                      <dt>
                        <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>
                      </dt>
                      <dd>
                        Your key beginning with <code>sb_publishable_</code>
                      </dd>
                    </dl>
                    <p>
                      Use the public publishable key only. A secret key, service-role key, or
                      database password must never go into these browser settings.
                    </p>
                    <a
                      href={`${repository}/settings/variables/actions`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open repository variables <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                  </div>
                </details>
              </li>
              <li>
                <details>
                  <summary>
                    <span className="setup-step-number">05</span>
                    <h3>Deploy, then create your account</h3>
                  </summary>
                  <div className="setup-step-body">
                    <p>
                      Open <strong>Actions → Deploy GitHub Pages → Run workflow</strong>. Select{' '}
                      <code>main</code> and run it. Wait for the build and deploy jobs to finish,
                      then reload the site. Saving variables alone does not start a deployment.
                    </p>
                    <a
                      href={`${repository}/actions/workflows/pages.yml`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open the deployment workflow <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                    <p>
                      Choose <strong>Create an account</strong>, confirm your email, and sign in.
                      Add your name, bio, avatar, and links; choose a theme; select{' '}
                      <strong>Publish page</strong> in the top bar. Each person registers their own
                      account on this same site.
                    </p>
                    <p>
                      Your dashboard generates your personal link and downloadable QR. Open a link
                      on your published page, then refresh Analytics to check that clicks are
                      recording.
                    </p>
                  </div>
                </details>
              </li>
            </ol>
            <a
              className="setup-documentation"
              href={`${repository}#github-pages-deployment`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Full setup & troubleshooting <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </section>

          <aside className="setup-side" aria-label="Your Linkboard installation">
            <section className="setup-note">
              <span className="setup-flower" aria-hidden="true">
                ✳
              </span>
              <h2>
                Your links.
                <br />
                Your style.
                <br />
                Your corner.
              </h2>
              <p>
                A personal page, custom themes, downloadable QR codes, and private click analytics.
                All in one place.
              </p>
              {needsBackendSetup && (
                <p className="setup-pending">
                  Sign-in, profile editing, and analytics become available after the connection
                  above is deployed.
                </p>
              )}
              <Link href="/login/" className="setup-cta">
                Go to sign in <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </section>
            {address && (
              <section className="setup-share" aria-labelledby="site-qr-heading">
                <div>
                  <h2 id="site-qr-heading">Take the site with you.</h2>
                  <p>Scan to open this website on your phone.</p>
                </div>
                <QRCode url={address} name="website" size={144} />
                <a className="setup-site-address" href={address}>
                  {address.replace('https://', '')}
                </a>
              </section>
            )}
          </aside>
        </div>
      </main>
      <footer className="setup-footer">
        <span>Your links. Your home on the internet.</span>
        <a href={repository} target="_blank" rel="noopener noreferrer">
          View source <ArrowUpRight size={13} aria-hidden="true" />
        </a>
      </footer>
    </div>
  );
}
