'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCheck,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  GripVertical,
  HelpCircle,
  LayoutGrid,
  Link2,
  Loader2,
  LogOut,
  Menu,
  MousePointer2,
  Palette,
  Plus,
  QrCode as QrIcon,
  Settings,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { getCurrentUser, loadDashboard, saveProfile, signOut, subscribeAuth } from '@/lib/data';
import { validateProfile } from '@/lib/validation';
import { dailyClicks } from '@/lib/analytics';
import { publicProfileUrl, isStaticExport, confirmationFailure } from '@/lib/urls';
import type { Account, ClickEvent, Platform, Profile, Theme } from '@/lib/types';
import ProfileCard from './profile-card';
import QRCode from './qr-code';
import { PlatformIcon } from './icons';
import { AnimatedBackground } from './motion/animated-background';
import { TransitionPanel } from './motion/transition-panel';
import ThemeToggle from './theme/toggle';

type Tab = 'links' | 'appearance' | 'analytics' | 'qr' | 'settings';
const navigation = [
  { id: 'links', label: 'My links', icon: Link2 },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'qr', label: 'QR code', icon: QrIcon },
] as const;
const platforms: { value: Platform; label: string }[] = [
  { value: 'website', label: 'Website' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'spotify', label: 'Spotify' },
  { value: 'github', label: 'GitHub' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'mail', label: 'Email' },
];
const themes: { id: Theme; name: string; color: string; accent: string }[] = [
  { id: 'sand', name: 'Sunday', color: '#ede7db', accent: '#fffdf7' },
  { id: 'sage', name: 'Botanical', color: '#dce5d8', accent: '#f6f8ee' },
  { id: 'rose', name: 'Rosewater', color: '#eeddda', accent: '#fff7f4' },
  { id: 'ink', name: 'After hours', color: '#282e2c', accent: '#424a46' },
];

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');
}
function Avatar({ profile, size = '' }: { profile: Profile; size?: string }) {
  const [failedUrl, setFailedUrl] = useState('');
  return (
    <span className={`avatar ${size}`}>
      {profile.avatarUrl && failedUrl !== profile.avatarUrl ? (
        // User-provided HTTPS avatars do not require a build-time image host allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatarUrl}
          alt=""
          onError={() => setFailedUrl(profile.avatarUrl)}
          referrerPolicy="no-referrer"
        />
      ) : (
        initials(profile.name)
      )}
    </span>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savedProfile, setSavedProfile] = useState<Profile | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [events, setEvents] = useState<ClickEvent[]>([]);
  const [tab, setTab] = useState<Tab>('links');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [origin, setOrigin] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [newLink, setNewLink] = useState({ title: '', url: '', platform: 'website' as Platform });
  const [newLinkError, setNewLinkError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [analyticsNow, setAnalyticsNow] = useState(0);
  const loadedAccount = useRef<string | null>(null);
  const loadSequence = useRef(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const saveErrorRef = useRef<HTMLDivElement>(null);
  const dirty =
    profile && savedProfile ? JSON.stringify(profile) !== JSON.stringify(savedProfile) : false;
  const initialize = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const confirmation = confirmationFailure(window.location.search, window.location.hash);
    try {
      const user = await getCurrentUser();
      if (sequence !== loadSequence.current) return;
      if (!user) {
        router.replace(confirmation ? `/login/?confirmation=${confirmation}` : '/login');
        return;
      }
      setAccount(user);
      loadedAccount.current = user?.id || null;
      const result = await loadDashboard(user?.id);
      if (sequence !== loadSequence.current) return;
      setProfile(result.profile);
      setSavedProfile(result.profile);
      setEvents(result.events);
      setAnalyticsNow(Date.now());
      const configured = process.env.NEXT_PUBLIC_SITE_URL;
      try {
        const url = new URL(configured || window.location.origin);
        setOrigin(['https:', 'http:'].includes(url.protocol) ? url.origin : window.location.origin);
      } catch {
        setOrigin(window.location.origin);
      }
    } catch (e) {
      if (sequence !== loadSequence.current) return;
      setLoadError(
        e instanceof Error ? e.message : 'We couldn’t load your board. Please try again.',
      );
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [router]);
  useEffect(() => {
    // Load the authenticated account and its saved server data after awaited I/O.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void initialize();
    let deferred: ReturnType<typeof setTimeout> | undefined;
    const confirmation = confirmationFailure(window.location.search, window.location.hash);
    let unsubscribe = () => {};
    const clearAccountView = () => {
      ++loadSequence.current;
      setAccount(null);
      setProfile(null);
      setSavedProfile(null);
      setEvents([]);
      setSaving(false);
      setRefreshing(false);
      setLoadError('');
      setError('');
      setToast('');
      setShareOpen(false);
      setPreviewOpen(false);
      setAddOpen(false);
      setNewLink({ title: '', url: '', platform: 'website' });
      setNewLinkError('');
    };
    try {
      unsubscribe = subscribeAuth((user) => {
        if (!user) {
          clearAccountView();
          router.replace(confirmation ? `/login/?confirmation=${confirmation}` : '/login');
        } else if (user && loadedAccount.current && user.id !== loadedAccount.current) {
          clearAccountView();
          setLoading(true);
          // Supabase auth callbacks must release their lock before calling auth again.
          deferred = setTimeout(() => void initialize(), 0);
        }
      });
    } catch {
      // initialize presents configuration errors in the page.
    }
    return () => {
      // This counter invalidates pending reads; cleanup intentionally uses its latest value.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++loadSequence.current;
      clearTimeout(deferred);
      unsubscribe();
    };
  }, [initialize, router]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    // The sticky save/publish action can be used while its error summary is offscreen.
    if (error) saveErrorRef.current?.scrollIntoView({ block: 'center' });
  }, [error]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (shareOpen || addOpen || previewOpen) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [shareOpen, addOpen, previewOpen]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNav(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  function update(values: Partial<Profile>) {
    setProfile((p) => (p ? { ...p, ...values } : p));
    setError('');
  }
  async function save(published?: boolean) {
    if (!profile || saving) return;
    const snapshot = structuredClone(profile);
    if (published !== undefined) snapshot.published = published;
    const issue = validateProfile(snapshot);
    if (issue) {
      setError(issue);
      return;
    }
    const sequence = loadSequence.current;
    setSaving(true);
    setPublishing(snapshot.published && !savedProfile?.published);
    setError('');
    try {
      await saveProfile(snapshot);
      if (sequence !== loadSequence.current) return;
      setSavedProfile(snapshot);
      if (published !== undefined) {
        // Keep edits made while saving; only reconcile the explicit visibility change.
        setProfile((current) =>
          current?.id === snapshot.id ? { ...current, published: snapshot.published } : current,
        );
      }
      setToast(
        snapshot.published
          ? savedProfile?.published
            ? 'Your changes are live.'
            : 'Your page is published. Ready to share!'
          : 'Your private profile is saved.',
      );
    } catch (e) {
      if (sequence !== loadSequence.current) return;
      setError(e instanceof Error ? e.message : 'Changes couldn’t be saved. Please try again.');
    } finally {
      if (sequence === loadSequence.current) setSaving(false);
    }
  }
  async function refreshAnalytics() {
    const sequence = loadSequence.current;
    setRefreshing(true);
    try {
      const result = await loadDashboard(account?.id);
      if (sequence !== loadSequence.current) return;
      setEvents(result.events);
      setAnalyticsNow(Date.now());
      setToast('Analytics are up to date.');
    } catch (e) {
      if (sequence !== loadSequence.current) return;
      setError(e instanceof Error ? e.message : 'Couldn’t refresh analytics.');
    } finally {
      if (sequence === loadSequence.current) setRefreshing(false);
    }
  }
  const pageUrl = origin && savedProfile ? publicProfileUrl(savedProfile.username, origin) : '';
  const displayUrl = pageUrl.replace(/^https?:\/\//, '');
  async function copyUrl() {
    if (!pageUrl) return;
    try {
      await navigator.clipboard.writeText(pageUrl);
      setToast('Your page link is copied.');
    } catch {
      setShareOpen(true);
      setToast('Select and copy your page address below.');
    }
  }
  function addLink(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const candidate = {
      ...profile,
      links: [
        ...profile.links,
        {
          ...newLink,
          title: newLink.title.trim(),
          url: newLink.url.trim(),
          id: crypto.randomUUID(),
          enabled: true,
        },
      ],
    };
    const issue = validateProfile(candidate);
    if (issue) {
      setNewLinkError(issue);
      return;
    }
    update({ links: candidate.links });
    setAddOpen(false);
    setNewLink({ title: '', url: '', platform: 'website' });
    setNewLinkError('');
  }
  function moveLink(index: number, direction: number) {
    if (!profile) return;
    const list = [...profile.links];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    update({ links: list });
  }
  async function logOut() {
    if (dirty && !window.confirm('You have unsaved changes. Sign out without saving?')) return;
    try {
      await signOut();
      router.push('/login');
    } catch {
      setError('Couldn’t sign out. Please try again.');
    }
  }
  if (loading)
    return (
      <div className="loading-page">
        <div className="brand">
          linkboard<span>✳</span>
        </div>
        <Loader2 className="spin" size={24} />
        <p>Getting your space ready…</p>
      </div>
    );
  if (loadError || !profile)
    return (
      <main className="state-page">
        <h1>Let’s try that again.</h1>
        <p>{loadError || 'Your session has ended.'}</p>
        <button
          className="button primary"
          onClick={() => {
            setLoading(true);
            setLoadError('');
            void initialize();
          }}
        >
          Reload your board
        </button>
        <Link href="/login" className="text-link">
          Go to sign in
        </Link>
      </main>
    );
  const activeLinks = profile.links.filter((l) => l.enabled).length;
  const chart = dailyClicks(events, analyticsDays, analyticsNow);
  const weekClicks = analyticsDays === 7 ? chart.total : dailyClicks(events, 7, analyticsNow).total;
  const counts = Object.fromEntries(
    profile.links.map((l) => [l.id, events.filter((e) => e.linkId === l.id).length]),
  );
  const activeTab = navigation.find((n) => n.id === tab)?.label || 'Settings';

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside id="workspace-sidebar" className={`sidebar ${mobileNav ? 'is-open' : ''}`}>
        <Link href="/" className="brand" aria-label="Linkboard home">
          linkboard<span>✳</span>
        </Link>
        <div className="workspace-switch">
          <span className="workspace-symbol">
            <LayoutGrid size={18} />
          </span>
          <div>
            <strong>Personal workspace</strong>
            <small>Make yourself at home</small>
          </div>
        </div>
        <div className="nav-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          <AnimatedBackground value={tab}>
            {navigation.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                data-id={id}
                className={`nav-item ${tab === id ? 'active' : ''}`}
                onClick={() => {
                  setTab(id);
                  setMobileNav(false);
                  setError('');
                }}
                aria-current={tab === id ? 'page' : undefined}
              >
                <Icon size={19} />
                <span>{label}</span>
                {id === 'links' && <span className="nav-count">{profile.links.length}</span>}
              </button>
            ))}
          </AnimatedBackground>
        </nav>
        <div className="sidebar-bottom">
          <div className="little-note">
            <span className="note-spark">✳</span>
            <strong>
              A small page.
              <br />
              Endless possibilities.
            </strong>
            <p>
              Everything you create,
              <br />
              in one little corner.
            </p>
            <span className="free-label">
              <span /> Free. Yours. Always.
            </span>
          </div>
          <button
            className={`nav-item ${tab === 'settings' ? 'active' : ''}`}
            onClick={() => {
              setTab('settings');
              setMobileNav(false);
            }}
          >
            <Settings size={19} />
            Settings
          </button>
          <a
            className="nav-item"
            href="https://github.com/20SHA07/linkboard/tree/codex/nextjs-linkboard#readme"
            target="_blank"
            rel="noopener noreferrer"
          >
            <HelpCircle size={19} />
            Hosting & resources
            <ArrowUpRight size={14} />
          </a>
          <div className="sidebar-account">
            <Avatar profile={profile} size="small" />
            <div>
              <strong>{profile.name}</strong>
              <small>{account?.email}</small>
            </div>
            <button
              className="icon-button"
              onClick={() => void logOut()}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={mobileNav}
              aria-controls="workspace-sidebar"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={22} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{activeTab}</strong>
          </div>
          <div className="topbar-actions">
            <ThemeToggle compact />
            {savedProfile?.published ? (
              <a
                className="button secondary view-page"
                href={pageUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={15} />
                View page
              </a>
            ) : (
              <button
                className="button secondary view-page"
                onClick={() => setPreviewOpen(true)}
                aria-label="Preview your page"
              >
                <Eye size={15} />
                Preview page
              </button>
            )}
            <button
              className={`button primary ${savedProfile?.published ? 'save-button' : 'publish-button'}`}
              onClick={() => void save(savedProfile?.published ? undefined : true)}
              disabled={saving || (Boolean(savedProfile?.published) && !dirty)}
              title={
                savedProfile?.published
                  ? 'Save your changes'
                  : 'Save your edits and publish your page'
              }
              aria-busy={saving}
            >
              {saving ? (
                <Loader2 className="spin" size={16} aria-hidden="true" />
              ) : !savedProfile?.published ? (
                <ArrowUpRight size={16} aria-hidden="true" />
              ) : dirty ? (
                <Check size={16} />
              ) : (
                <CheckCheck size={16} />
              )}
              <span>
                {saving
                  ? publishing
                    ? 'Publishing…'
                    : 'Saving…'
                  : !savedProfile?.published
                    ? 'Publish page'
                    : dirty
                      ? 'Save changes'
                      : 'All changes saved'}
              </span>
            </button>
          </div>
        </header>
        <div className="workspace-content">
          <main id="main-content" className="editor-column">
            <div className="page-heading">
              <div className="eyebrow">A SPACE THAT’S ALL YOU</div>
              <h1>
                {tab === 'links'
                  ? 'Good things, all in one place.'
                  : tab === 'appearance'
                    ? 'Make it feel like you.'
                    : tab === 'analytics'
                      ? 'See what connects.'
                      : tab === 'qr'
                        ? 'A little scan. A new connection.'
                        : 'Your space, your details.'}
              </h1>
              <p>
                {tab === 'links'
                  ? 'Your ideas, your work, your world. Bring it all together.'
                  : tab === 'appearance'
                    ? 'Find a look for your little corner of the internet.'
                    : tab === 'analytics'
                      ? 'A closer look at where your visitors are heading.'
                      : tab === 'qr'
                        ? 'Take your page beyond the screen. Share it anywhere.'
                        : 'Introduce yourself and make your page your own.'}
              </p>
            </div>
            {!savedProfile?.published && (
              <div className="draft-banner">
                <span className="status-dot" />
                <span>Your page is private. Use Publish page above when you’re ready.</span>
                <button onClick={() => void save(false)} disabled={saving || !dirty}>
                  Save draft <Check size={12} aria-hidden="true" />
                </button>
              </div>
            )}
            {error && (
              <div className="alert error" role="alert" ref={saveErrorRef}>
                {error}
                <button
                  className="icon-button"
                  aria-label="Dismiss error"
                  onClick={() => setError('')}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <TransitionPanel activeKey={`${profile.id}:${tab}`}>
              {tab === 'links' && (
                <>
                  <section className="profile-summary">
                    <Avatar key={profile.avatarUrl} profile={profile} />
                    <div className="profile-summary-info">
                      <div className="summary-name">
                        {profile.name}
                        <span className="personal-badge">
                          {savedProfile?.published ? 'Published' : 'Private'}
                        </span>
                      </div>
                      <p>
                        {profile.bio.split('\n')[0] || 'A little introduction goes a long way.'}
                      </p>
                      <button className="profile-url" onClick={() => void copyUrl()}>
                        <Link2 size={12} />
                        <span>{displayUrl}</span>
                        <Copy size={12} />
                      </button>
                    </div>
                    <button className="button small-button" onClick={() => setTab('settings')}>
                      Edit profile
                    </button>
                  </section>
                  <div className="quick-stats">
                    <div>
                      <span className="stat-icon">
                        <Link2 size={17} />
                      </span>
                      <span>
                        <strong>{activeLinks}</strong>
                        <small>Active links</small>
                      </span>
                    </div>
                    <span className="stat-divider" />
                    <div>
                      <span className="stat-icon">
                        <MousePointer2 size={17} />
                      </span>
                      <span>
                        <strong>{events.length.toLocaleString()}</strong>
                        <small>Total clicks</small>
                      </span>
                    </div>
                    <button className="stats-link" onClick={() => setTab('analytics')}>
                      View analytics
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="section-heading">
                    <div>
                      <h2>
                        Your links <span>{profile.links.length}</span>
                      </h2>
                      <p>A collection of things worth sharing.</p>
                    </div>
                    <button
                      className="button primary"
                      onClick={() => {
                        setAddOpen(true);
                        setNewLinkError('');
                      }}
                      disabled={profile.links.length >= 30}
                    >
                      <Plus size={17} />
                      Add a link
                    </button>
                  </div>
                  <div className="link-list">
                    {profile.links.map((link, index) => (
                      <article
                        className={`editor-link ${!link.enabled ? 'link-disabled' : ''}`}
                        key={link.id}
                      >
                        <div className="reorder-controls">
                          <GripVertical size={18} aria-hidden="true" />
                          <div>
                            <button
                              aria-label={`Move ${link.title} up`}
                              disabled={index === 0}
                              onClick={() => moveLink(index, -1)}
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              aria-label={`Move ${link.title} down`}
                              disabled={index === profile.links.length - 1}
                              onClick={() => moveLink(index, 1)}
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>
                        </div>
                        <div className={`link-platform platform-${link.platform}`}>
                          <PlatformIcon platform={link.platform} />
                        </div>
                        <div className="link-inputs">
                          <input
                            aria-label={`Link ${index + 1} title`}
                            value={link.title}
                            maxLength={80}
                            placeholder="Link title"
                            onChange={(e) =>
                              update({
                                links: profile.links.map((l) =>
                                  l.id === link.id ? { ...l, title: e.target.value } : l,
                                ),
                              })
                            }
                          />
                          <input
                            aria-label={`Link ${index + 1} URL`}
                            value={link.url}
                            maxLength={2048}
                            placeholder="https://your-website.com"
                            onChange={(e) =>
                              update({
                                links: profile.links.map((l) =>
                                  l.id === link.id ? { ...l, url: e.target.value } : l,
                                ),
                              })
                            }
                          />
                          <div className="link-meta">
                            <span>
                              <BarChart3 size={11} />
                              {counts[link.id] || 0} clicks
                            </span>
                            <select
                              aria-label={`Platform for ${link.title}`}
                              value={link.platform}
                              onChange={(e) =>
                                update({
                                  links: profile.links.map((l) =>
                                    l.id === link.id
                                      ? { ...l, platform: e.target.value as Platform }
                                      : l,
                                  ),
                                })
                              }
                            >
                              {platforms.map((p) => (
                                <option key={p.value} value={p.value}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="link-actions">
                          <button
                            className={`toggle ${link.enabled ? 'on' : ''}`}
                            role="switch"
                            aria-checked={link.enabled}
                            aria-label={`Show ${link.title || 'link'} on your page`}
                            onClick={() =>
                              update({
                                links: profile.links.map((l) =>
                                  l.id === link.id ? { ...l, enabled: !l.enabled } : l,
                                ),
                              })
                            }
                          >
                            <span />
                          </button>
                          <button
                            className="icon-button delete-button"
                            aria-label={`Delete ${link.title || 'link'}`}
                            onClick={() =>
                              update({ links: profile.links.filter((l) => l.id !== link.id) })
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {profile.links.length === 0 && (
                    <div className="empty-state">
                      <Link2 size={28} />
                      <h3>Your next chapter starts with a link.</h3>
                      <p>Add your website, a favorite project, or somewhere to say hello.</p>
                    </div>
                  )}
                  <button
                    className="add-another"
                    onClick={() => {
                      setAddOpen(true);
                      setNewLinkError('');
                    }}
                    disabled={profile.links.length >= 30}
                  >
                    <Plus size={17} />
                    Add another link
                  </button>
                  <p className="editor-tip">
                    <Sparkles size={14} />A little tip: put your most important link at the top.
                  </p>
                </>
              )}
              {tab === 'appearance' && (
                <section className="settings-panel">
                  <div className="section-heading">
                    <div>
                      <h2>Pick your palette</h2>
                      <p>Four thoughtful themes. One that feels just right.</p>
                    </div>
                  </div>
                  <div className="theme-grid">
                    {themes.map((t) => (
                      <button
                        className={`theme-option ${profile.theme === t.id ? 'selected' : ''}`}
                        key={t.id}
                        onClick={() => update({ theme: t.id, backgroundColor: t.color })}
                        aria-pressed={profile.theme === t.id}
                      >
                        <div className="theme-sample" style={{ background: t.color }}>
                          <span className="sample-avatar" style={{ background: t.accent }} />
                          <span style={{ background: t.accent }} />
                          <span style={{ background: t.accent }} />
                          <span style={{ background: t.accent }} />
                        </div>
                        <span>
                          {t.name}
                          {profile.theme === t.id && <Check size={15} />}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="custom-color-row">
                    <div>
                      <h3>Something a little more you?</h3>
                      <p>Choose your own background color.</p>
                    </div>
                    <label className="color-input">
                      <input
                        type="color"
                        aria-label="Custom background color"
                        value={profile.backgroundColor}
                        onChange={(e) =>
                          update({ backgroundColor: e.target.value, theme: 'custom' })
                        }
                      />
                      <span>{profile.backgroundColor}</span>
                    </label>
                  </div>
                  <p className="field-help">
                    Your links and text automatically stay readable on your chosen background.
                  </p>
                </section>
              )}
              {tab === 'analytics' && (
                <section className="analytics-section">
                  <div className="section-heading">
                    <div>
                      <h2>Your page at a glance</h2>
                      <p>Clicks across all browsers, stored securely for your account.</p>
                    </div>
                    <button
                      className="button small-button"
                      disabled={refreshing}
                      onClick={() => void refreshAnalytics()}
                    >
                      {refreshing ? 'Refreshing…' : 'Refresh'}
                    </button>
                  </div>
                  <div className="analytics-cards">
                    <div>
                      <MousePointer2 size={20} />
                      <strong>{events.length.toLocaleString()}</strong>
                      <span>All-time clicks</span>
                    </div>
                    <div>
                      <Link2 size={20} />
                      <strong>{weekClicks.toLocaleString()}</strong>
                      <span>Last 7 days</span>
                    </div>
                    <div>
                      <BarChart3 size={20} />
                      <strong>{new Set(events.map((e) => e.linkId)).size}</strong>
                      <span>Links visited</span>
                    </div>
                  </div>
                  <div className="chart-panel">
                    <div className="section-heading">
                      <h3>Little moments of connection</h3>
                      <select
                        aria-label="Analytics period"
                        value={analyticsDays}
                        onChange={(e) => setAnalyticsDays(Number(e.target.value))}
                      >
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                      </select>
                    </div>
                    <div
                      className="bar-chart"
                      role="img"
                      aria-label={`${chart.total} clicks in the last ${analyticsDays} days`}
                    >
                      {chart.days.map(({ date: d, count: n }, i) => {
                        const day = d.toLocaleDateString();
                        return (
                          <div className="chart-day" key={i} title={`${day}: ${n} clicks`}>
                            <div className="chart-bar-track">
                              <div
                                style={{ height: `${Math.max(2, (n / chart.peak) * 100)}%` }}
                                className={n === 0 ? 'zero' : ''}
                              />
                            </div>
                            {(analyticsDays === 7 || i % 5 === 0) && (
                              <span>
                                {d.toLocaleDateString(undefined, {
                                  weekday: analyticsDays === 7 ? 'short' : undefined,
                                  day: analyticsDays === 30 ? 'numeric' : undefined,
                                })}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {events.length === 0 && (
                      <p className="chart-empty">
                        Your story is just starting. Share your page to see your first clicks.
                      </p>
                    )}
                  </div>
                  <div className="analytics-table">
                    <h3>Link performance</h3>
                    <div className="table-row table-head">
                      <span>Link</span>
                      <span>Last click</span>
                      <span>Clicks</span>
                    </div>
                    {profile.links.map((l) => {
                      const recent = events
                        .filter((e) => e.linkId === l.id)
                        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
                      return (
                        <div className="table-row" key={l.id}>
                          <span>
                            <PlatformIcon platform={l.platform} size={16} />
                            {l.title}
                          </span>
                          <span>
                            {recent
                              ? new Date(recent.timestamp).toLocaleString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'No clicks yet'}
                          </span>
                          <strong>{counts[l.id] || 0}</strong>
                        </div>
                      );
                    })}
                  </div>
                  <p className="field-help">
                    Click totals count interactions, not unique visitors. Analytics doesn’t store
                    visitor identities or use tracking cookies.
                  </p>
                </section>
              )}
              {tab === 'qr' && (
                <section className="settings-panel qr-settings">
                  <div className="qr-intro">
                    <span className="feature-icon">
                      <QrIcon size={26} />
                    </span>
                    <h2>Your world. One scan away.</h2>
                    <p>
                      Put it on your business card, your packaging,
                      <br />
                      or wherever your next connection happens.
                    </p>
                  </div>
                  {pageUrl ? (
                    <QRCode url={pageUrl} name={savedProfile?.username} size={240} downloadable />
                  ) : (
                    <p>Preparing your page URL…</p>
                  )}
                  <div className="copy-url-field">
                    <input aria-label="Public page URL" readOnly value={pageUrl} />
                    <button
                      className="icon-button"
                      onClick={() => void copyUrl()}
                      aria-label="Copy public page URL"
                    >
                      <Copy size={17} />
                    </button>
                  </div>
                  <p className="field-help">
                    This code points to your saved page address. Save changes after updating your
                    username, then download a fresh code.
                  </p>
                </section>
              )}
              {tab === 'settings' && (
                <form
                  className="settings-panel profile-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save();
                  }}
                >
                  <div className="section-heading">
                    <div>
                      <h2>A little introduction</h2>
                      <p>The person behind all the good things.</p>
                    </div>
                    <Avatar key={profile.avatarUrl} profile={profile} />
                  </div>
                  <label>
                    Display name
                    <input
                      value={profile.name}
                      maxLength={60}
                      required
                      onChange={(e) => update({ name: e.target.value })}
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    Your bio
                    <textarea
                      rows={3}
                      value={profile.bio}
                      maxLength={280}
                      onChange={(e) => update({ bio: e.target.value })}
                    />
                    <span className="field-help">
                      A sentence or two is perfect. {profile.bio.length}/280
                    </span>
                  </label>
                  <label>
                    Profile image URL
                    <input
                      type="url"
                      placeholder="https://example.com/your-photo.jpg"
                      value={profile.avatarUrl}
                      maxLength={2048}
                      onChange={(e) => update({ avatarUrl: e.target.value })}
                    />
                    <span className="field-help">
                      Use an HTTPS image URL. Leave blank for a simple initials avatar.
                    </span>
                  </label>
                  <label>
                    Username
                    <div className="username-input">
                      <span>{isStaticExport ? '/u/?username=' : '/u/'}</span>
                      <input
                        value={profile.username}
                        minLength={3}
                        maxLength={30}
                        pattern="[a-z0-9]+(-[a-z0-9]+)*"
                        required
                        onChange={(e) => update({ username: e.target.value.toLowerCase() })}
                      />
                    </div>
                    <span className="field-help">
                      3–30 lowercase letters, numbers, or hyphens. Changing this changes your public
                      URL and QR code.
                    </span>
                  </label>
                  <div className="setting-switch">
                    <div>
                      <strong>Publish your page</strong>
                      <p>Make your profile and enabled links visible to everyone.</p>
                    </div>
                    <button
                      type="button"
                      className={`toggle ${profile.published ? 'on' : ''}`}
                      role="switch"
                      aria-checked={profile.published}
                      aria-label="Publish your page"
                      disabled={saving}
                      onClick={() => update({ published: !profile.published })}
                    >
                      <span />
                    </button>
                  </div>
                  <button className="button primary" disabled={saving || !dirty} type="submit">
                    {saving ? 'Saving…' : 'Save profile'}
                    <Check size={16} />
                  </button>
                </form>
              )}
              <footer className="editor-footer">
                <span>A home for everything you do.</span>
                <span>
                  Made for you <span className="footer-spark">✳</span>
                </span>
              </footer>
            </TransitionPanel>
          </main>
          <aside className="preview-column">
            <div className="preview-heading">
              <span>
                <span className="status-dot" />
                Live preview
              </span>
              <span>Made to look good, everywhere.</span>
            </div>
            <div className="phone-frame">
              <div className="phone-screen">
                <div className="phone-status">
                  <span>9:41</span>
                  <div className="phone-island" />
                  <span className="phone-signal">
                    ▮▮▮ <span>▰</span>
                  </span>
                </div>
                <div className="phone-profile">
                  <ProfileCard profile={profile} compact />
                </div>
              </div>
            </div>
            <div className="preview-caption">
              <Eye size={14} />
              {dirty ? 'Previewing your unsaved changes' : 'A little preview of your big world'}
            </div>
            <div className="share-preview">
              <div className="share-text">
                <span className="share-icon">
                  <QrIcon size={21} />
                </span>
                <div>
                  <strong>Take your page places.</strong>
                  <p>Your own QR code, ready to share.</p>
                </div>
              </div>
              <button className="button secondary" onClick={() => setShareOpen(true)}>
                Share your page
                <ArrowUpRight size={15} />
              </button>
            </div>
            <p className="preview-footnote">
              <span />
              Your links. Your style. Your corner.
            </p>
          </aside>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={15} />
          </span>
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast('')}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <dialog
        ref={dialogRef}
        className="modal"
        onCancel={() => {
          setAddOpen(false);
          setShareOpen(false);
          setPreviewOpen(false);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setAddOpen(false);
            setShareOpen(false);
            setPreviewOpen(false);
          }
        }}
        aria-label={
          addOpen ? 'Add a new link' : previewOpen ? 'Preview your page' : 'Share your page'
        }
      >
        <button
          className="icon-button modal-close"
          aria-label="Close dialog"
          onClick={() => {
            setAddOpen(false);
            setShareOpen(false);
            setPreviewOpen(false);
          }}
        >
          <X size={20} />
        </button>
        {addOpen ? (
          <form onSubmit={addLink} className="profile-form">
            <span className="feature-icon">
              <Link2 size={24} />
            </span>
            <h2>Add something good.</h2>
            <p>A place, a project, or a little piece of you.</p>
            <label>
              Link title
              <input
                autoFocus
                required
                maxLength={80}
                placeholder="My portfolio"
                value={newLink.title}
                onChange={(e) => setNewLink((n) => ({ ...n, title: e.target.value }))}
              />
            </label>
            <label>
              URL
              <input
                required
                maxLength={2048}
                placeholder="https://example.com"
                value={newLink.url}
                onChange={(e) => setNewLink((n) => ({ ...n, url: e.target.value }))}
              />
            </label>
            <label>
              Platform
              <select
                value={newLink.platform}
                onChange={(e) =>
                  setNewLink((n) => ({ ...n, platform: e.target.value as Platform }))
                }
              >
                {platforms.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            {newLinkError && (
              <p className="form-error" role="alert">
                {newLinkError}
              </p>
            )}
            <button className="button primary full-width" type="submit">
              <Plus size={16} />
              Add to your page
            </button>
          </form>
        ) : previewOpen ? (
          <ProfileCard profile={profile} showBrand={false} />
        ) : shareOpen ? (
          <div className="share-modal">
            <span className="eyebrow">GOOD THINGS ARE MEANT TO BE SHARED</span>
            <h2>Meet your new calling card.</h2>
            <p>One link. Everything that makes you, you.</p>
            {pageUrl && (
              <QRCode url={pageUrl} name={savedProfile?.username} size={224} downloadable />
            )}
            <div className="copy-url-field">
              <input aria-label="Share page address" readOnly value={pageUrl} />
              <button
                className="icon-button"
                onClick={() => void copyUrl()}
                aria-label="Copy page address"
              >
                <Copy size={17} />
              </button>
            </div>
            <a className="text-link" href={pageUrl} target="_blank" rel="noopener noreferrer">
              Open your page
              <ArrowUpRight size={14} />
            </a>
            {!savedProfile?.published && (
              <p className="field-help">
                Your page is private. Use Publish page in the top bar before sharing this code.
              </p>
            )}
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
