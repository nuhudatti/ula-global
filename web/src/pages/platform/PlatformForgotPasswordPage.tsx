import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformApi } from '../../lib/platformApi';
import '../../styles/platform-workspace.css';

type ForgotResponse = {
  ok: boolean;
  message?: string;
  devResetUrl?: string;
  devOutboxFile?: string;
  devHint?: string;
};

export function PlatformForgotPasswordPage() {
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
      const res = await platformApi<ForgotResponse>('/api/platform/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
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
    <div className="ula-platform-login min-h-dvh">
      <div className="ula-platform-login__card">
        <p className="ula-platform-login__eyebrow">ULA Global Platform</p>
        <h1 className="ula-platform-login__title">Forgot password</h1>
        <p className="ula-platform-login__sub">
          Platform operators only. Institution users must reset from their university login page.
        </p>

        {sent ? (
          <div className="mt-6 space-y-4 text-sm">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
              If a platform account exists for <strong>{email}</strong>, check your inbox for reset instructions. The
              link expires in 60 minutes.
            </div>
            {devHint ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">{devHint}</div>
            ) : null}
            {devResetUrl ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-950">
                <p className="font-medium">Development reset link</p>
                <a href={devResetUrl} className="mt-2 inline-block break-all font-medium text-slate-800 underline">
                  {devResetUrl}
                </a>
              </div>
            ) : null}
            <Link to="/platform/login" className="inline-block font-medium text-slate-700 hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Platform operator email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3"
                autoComplete="email"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? 'Sending…' : 'Send reset link'}
            </button>
            <Link to="/platform/login" className="block text-center text-sm text-slate-500 hover:text-slate-800">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
