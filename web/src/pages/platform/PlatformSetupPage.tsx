import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { platformApi, setPlatformToken, getPlatformToken } from '../../lib/platformApi';
import '../../styles/platform-workspace.css';

type SetupStatus = { setupRequired: boolean };

export function PlatformSetupPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (getPlatformToken()) return;
    platformApi<SetupStatus>('/api/platform/auth/setup/status')
      .then(setStatus)
      .catch(() => setStatus({ setupRequired: true }));
  }, []);

  if (getPlatformToken()) return <Navigate to="/platform" replace />;
  if (status && !status.setupRequired) return <Navigate to="/platform/login" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setBusy(true);
    try {
      const data = await platformApi<{
        token: string;
        operator: { fullName: string };
      }>('/api/platform/auth/setup', {
        method: 'POST',
        body: JSON.stringify({ email, password, fullName }),
      });
      setPlatformToken(data.token);
      navigate('/platform', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ula-platform-login min-h-dvh">
      <div className="ula-platform-login__card">
        <p className="ula-platform-login__eyebrow">ULA Global Platform</p>
        <h1 className="ula-platform-login__title">First-time setup</h1>
        <p className="ula-platform-login__sub">
          Create the platform super admin account. This runs once — after setup, this page is permanently locked.
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Full name</span>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
              autoComplete="name"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
              autoComplete="username"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
              autoComplete="new-password"
            />
            <span className="mt-1 block text-xs text-slate-500">
              12+ characters with uppercase, lowercase, number, and special character.
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Confirm password</span>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
              autoComplete="new-password"
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || status === null}
            className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? 'Creating account…' : 'Create super admin & continue'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">
          Already set up?{' '}
          <Link to="/platform/login" className="font-medium text-slate-700 hover:text-slate-900">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
