import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { platformApi, setPlatformToken } from '../../lib/platformApi';
import { PasswordInput } from '../../components/PasswordInput';
import '../../styles/platform-workspace.css';

type ResetPreview = { email: string; fullName: string; expiresAt: string };

export function PlatformResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();

  const [preview, setPreview] = useState<ResetPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    platformApi<ResetPreview>(`/api/platform/auth/reset-password/${encodeURIComponent(token)}`)
      .then(setPreview)
      .catch(() => setError('This reset link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setPending(true);
    setError('');
    try {
      const res = await platformApi<{ token: string }>('/api/platform/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setPlatformToken(res.token);
      navigate('/platform', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div className="ula-platform-login min-h-dvh">
        <div className="ula-platform-login__card text-center">
          <h1 className="text-xl font-semibold">Invalid reset link</h1>
          <Link to="/platform/forgot-password" className="mt-4 inline-block text-sm font-medium text-slate-700">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="ula-platform-login min-h-dvh">
        <div className="ula-platform-login__card text-center text-sm text-slate-500">Verifying reset link…</div>
      </div>
    );
  }

  if (!preview && error) {
    return (
      <div className="ula-platform-login min-h-dvh">
        <div className="ula-platform-login__card text-center">
          <h1 className="text-xl font-semibold">Link expired</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <Link to="/platform/forgot-password" className="mt-6 inline-block text-sm font-medium text-slate-700">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ula-platform-login min-h-dvh">
      <div className="ula-platform-login__card">
        <p className="ula-platform-login__eyebrow">ULA Global Platform</p>
        <h1 className="ula-platform-login__title">Set a new password</h1>
        <p className="ula-platform-login__sub">
          {preview?.fullName} · <span className="text-slate-500">{preview?.email}</span>
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">New password</span>
            <PasswordInput
              inputClassName="w-full rounded-xl border border-slate-200 px-4 py-3"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Confirm password</span>
            <PasswordInput
              inputClassName="w-full rounded-xl border border-slate-200 px-4 py-3"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
