import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { platformApi, setPlatformToken, getPlatformToken } from '../../lib/platformApi';
import '../../styles/platform-workspace.css';

type SetupStatus = { setupRequired: boolean };

export function PlatformLoginPage() {
  const navigate = useNavigate();
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (getPlatformToken()) return;
    platformApi<SetupStatus>('/api/platform/auth/setup/status')
      .then((s) => setSetupRequired(s.setupRequired))
      .catch(() => setSetupRequired(false));
  }, []);

  if (getPlatformToken()) return <Navigate to="/platform" replace />;
  if (setupRequired === true) return <Navigate to="/platform/setup" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await platformApi<{ token: string; setupRequired?: boolean }>('/api/platform/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setPlatformToken(data.token);
      navigate('/platform', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ula-platform-login min-h-dvh">
      <div className="ula-platform-login__card">
        <p className="ula-platform-login__eyebrow">ULA Global Platform</p>
        <h1 className="ula-platform-login__title">Operations sign-in</h1>
        <p className="ula-platform-login__sub">
          Platform operators only. Institution users must use their university login.
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
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
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="text-right">
            <Link to="/platform/forgot-password" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            disabled={busy || setupRequired === null}
            className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in to platform'}
          </button>
        </form>
      </div>
    </div>
  );
}
