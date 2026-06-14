import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { homePathForRole } from '../lib/authRedirects';
import { PasswordInput } from '../components/PasswordInput';
import { useTenantPaths } from '../hooks/useTenantPaths';

type ResetPreview = { email: string; fullName: string; expiresAt: string };

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { establishSession } = useAuth();
  const paths = useTenantPaths();

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
    api<ResetPreview>(`/api/auth/reset-password/${encodeURIComponent(token)}`)
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
      const res = await api<{ token: string; user: { role: string; institution?: { slug: string } | null } }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      establishSession(res.token, res.user as Parameters<typeof establishSession>[1]);
      navigate(homePathForRole(res.user.role, res.user.institution?.slug), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Invalid reset link</h1>
        <Link to={paths.forgotPassword} className="mt-4 inline-block text-sm font-medium text-primary-700">
          Request a new link
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-dark-500">
        <i className="fa-solid fa-spinner fa-spin mr-2" aria-hidden />
        Verifying reset link…
      </div>
    );
  }

  if (!preview && error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-dark-900">Link expired</h1>
        <p className="mt-2 text-sm text-dark-500">{error}</p>
        <Link to={paths.forgotPassword} className="mt-6 inline-block text-sm font-medium text-primary-700">
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#0f4c81]">Secure recovery</p>
      <h1 className="mt-2 text-2xl font-semibold text-dark-900">Set a new password</h1>
      <p className="mt-2 text-sm text-dark-600">
        {preview?.fullName} · <span className="text-dark-500">{preview?.email}</span>
      </p>

      <form onSubmit={onSubmit} className="ula-panel mt-8 space-y-4 p-6">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        ) : null}
        <div>
          <label className="mb-2 block text-sm font-medium text-dark-700">New password</label>
          <PasswordInput
            inputClassName="w-full rounded-xl bg-dark-50 px-3 py-2.5 text-sm ring-1 ring-dark-200"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-dark-700">Confirm password</label>
          <PasswordInput
            inputClassName="w-full rounded-xl bg-dark-50 px-3 py-2.5 text-sm ring-1 ring-dark-200"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="btn-ula-primary w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
