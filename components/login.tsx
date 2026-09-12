'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { getCurrentUser, signIn, signUp } from '@/lib/data';
import { validateEmail } from '@/lib/validation';
import { needsBackendSetup } from '@/lib/backend-config';
import ThemeToggle from './theme/toggle';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [checkingSession, setCheckingSession] = useState(!needsBackendSetup);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (needsBackendSetup) return;
    let active = true;
    void getCurrentUser()
      .then((user) => {
        if (active && user) router.replace('/');
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'We couldn’t check your session. Please try signing in again.',
          );
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, [router]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || checkingSession || needsBackendSetup) return;
    setError('');
    setMessage('');
    if (!validateEmail(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length > 128) {
      setError('Enter your password, up to 128 characters.');
      return;
    }
    if (mode === 'signup' && (password.length < 12 || password.length > 128)) {
      setError('Use a password between 12 and 128 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        router.replace('/');
      } else {
        const result = await signUp(email.trim(), password);
        if (result.confirmationRequired) {
          setMessage(
            'Check your inbox for a confirmation link. After confirming your email, sign in to your new space.',
          );
          setPassword('');
          setMode('signin');
        } else router.replace('/');
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'We couldn’t complete your request. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-shell">
      <aside className="auth-story">
        <Link href="/" className="brand">
          linkboard<span aria-hidden="true">✳</span>
        </Link>
        <div className="auth-story-content">
          <span className="eyebrow">YOUR OWN LITTLE CORNER</span>
          <h1>
            You do a lot.
            <br />
            Give it a home.
          </h1>
          <p>A thoughtful little space for everything you create, love, and want to share.</p>
          <span className="auth-flower" aria-hidden="true">
            ✳
          </span>
        </div>
        <span className="auth-story-footer">Your links. Your style. Your corner.</span>
      </aside>
      <main className="auth-main">
        <div className="auth-theme-controls">
          <ThemeToggle />
        </div>
        <form className="auth-form" onSubmit={submit} aria-labelledby="auth-heading">
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h2 id="auth-heading">
            {mode === 'signin' ? 'Good to have you here.' : 'A space of your own.'}
          </h2>
          <p>
            {mode === 'signin'
              ? 'Sign in and pick up where you left off.'
              : 'Create an account. Bring your world together.'}
          </p>
          {needsBackendSetup && (
            <div className="auth-notice setup-auth-notice" role="status">
              <strong>Account setup is pending.</strong>
              <p>The site owner needs to connect Supabase before anyone can sign in or register.</p>
              <Link href="/setup/">
                Open the setup guide <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )}
          <label htmlFor="auth-email">
            Email address
            <input
              id="auth-email"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              disabled={busy || needsBackendSetup}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label htmlFor="auth-password">
            Password
            <input
              id="auth-password"
              name="password"
              type="password"
              required
              maxLength={128}
              minLength={mode === 'signup' ? 12 : undefined}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              aria-describedby={mode === 'signup' ? 'password-help' : undefined}
              disabled={busy || needsBackendSetup}
              placeholder={mode === 'signup' ? 'At least 12 characters' : 'Your password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'signup' && (
              <span className="field-help" id="password-help">
                Choose a unique password with at least 12 characters.
              </span>
            )}
          </label>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="auth-notice" role="status">
              {message}
            </div>
          )}
          <button
            className="button primary full-width"
            disabled={busy || checkingSession || needsBackendSetup}
            type="submit"
            aria-busy={busy || checkingSession}
          >
            {busy || checkingSession ? (
              <>
                <Loader2 className="spin" size={16} aria-hidden="true" />
                {checkingSession
                  ? 'Checking your session…'
                  : mode === 'signup'
                    ? 'Creating your account…'
                    : 'Signing you in…'}
              </>
            ) : (
              <>
                {mode === 'signin' ? 'Sign in to your space' : 'Create your account'}
                <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
          <div className="auth-toggle">
            {mode === 'signin' ? 'New around here?' : 'Already have a space?'}
            <button
              type="button"
              disabled={busy || checkingSession}
              onClick={() => {
                setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
                setPassword('');
                setError('');
                setMessage('');
              }}
            >
              {mode === 'signin' ? 'Create an account' : 'Sign in'}
            </button>
          </div>
          <div className="auth-divider">A HOME FOR EVERYTHING YOU DO</div>
        </form>
      </main>
    </div>
  );
}
