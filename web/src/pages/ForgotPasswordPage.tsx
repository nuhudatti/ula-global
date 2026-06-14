import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useTenantPaths } from '../hooks/useTenantPaths';

type ForgotPasswordResponse = {
  ok: boolean;
  message?: string;
  devResetUrl?: string;
  devOutboxFile?: string;
  devHint?: string;
};

export function ForgotPasswordPage() {
  const paths = useTenantPaths();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState('');
  const [devHint, setDevHint] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError('');
    setDevResetUrl('');
    setDevHint('');
    try {
      const res = await api<ForgotPasswordResponse>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          institutionSlug: paths.slug || undefined,
        }),
      });
      setSent(true);
      if (res.devResetUrl) setDevResetUrl(res.devResetUrl);
      if (res.devHint) setDevHint(res.devHint);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 md:py-16">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#0f4c81]">Account recovery</p>
      <h1 className="mt-2 text-2xl font-semibold text-dark-900">Forgot password</h1>
      <p className="mt-2 text-sm text-dark-600">
        Enter your institutional email. We&apos;ll send a secure reset link if an account exists.
      </p>

      {sent ? (
        <div className="ula-panel mt-8 space-y-4 p-6">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            If an account exists for <strong>{email}</strong>, check your inbox for reset instructions. The link
            expires in 60 minutes.
          </div>
          {devHint ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {devHint}
            </div>
          ) : null}
          {devResetUrl ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
              <p className="font-medium">Development reset link (use this if email does not arrive)</p>
              <a href={devResetUrl} className="mt-2 inline-block break-all font-medium text-primary-700 underline">
                {devResetUrl}
              </a>
              <p className="mt-2 text-xs text-sky-800">
                A copy is also saved in <code className="rounded bg-white/70 px-1">data/email-outbox/</code> on this
                computer.
              </p>
            </div>
          ) : null}
          <p className="text-xs text-dark-500">
            The email usually arrives within a minute. Check your <strong>inbox</strong> first, then{' '}
            <strong>Junk</strong> or <strong>Spam</strong> if you do not see it. The message shows your
            institution logo and name — mark it as <strong>Not spam</strong> so future mail goes to your inbox.
          </p>
          <p className="text-xs text-dark-500">
            Use the email registered at your institution (e.g. <strong>admin@demo.ibbul.edu</strong> for IBBUL demo).
            Open forgot password from your university URL, e.g. <strong>/ibbul/forgot-password</strong>.
          </p>
          <Link to={paths.login} className="inline-block text-sm font-medium text-primary-700 hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="ula-panel mt-8 space-y-4 p-6">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
          ) : null}
          <div>
            <label className="mb-2 block text-sm font-medium text-dark-700">Email</label>
            <input
              className="w-full rounded-xl border-0 bg-dark-50 py-2.5 px-3 text-sm ring-1 ring-dark-200 focus:ring-2 focus:ring-primary-500"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="btn-ula-primary w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? 'Sending…' : 'Send reset link'}
          </button>
          <Link to={paths.login} className="block text-center text-sm text-dark-500 hover:text-dark-800">
            Back to sign in
          </Link>
        </form>
      )}
    </div>
  );
}
