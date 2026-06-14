import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { homePathForRole } from '../lib/authRedirects';
import { PasswordInput } from '../components/PasswordInput';

export function ForceChangePasswordPage() {
  const { user, establishSession } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

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
      const res = await api<{ token: string; user: { role: string; institution?: { slug: string } | null } }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: password }),
      });
      establishSession(res.token, res.user as Parameters<typeof establishSession>[1]);
      navigate(homePathForRole(res.user.role, res.user.institution?.slug), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 md:py-16">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#0f4c81]">Security required</p>
      <h1 className="mt-2 text-2xl font-semibold text-dark-900">Set your permanent password</h1>
      <p className="mt-2 text-sm text-dark-600">
        {user?.fullName}, your account was created with a one-time password. Choose a new password to continue.
      </p>

      <form onSubmit={onSubmit} className="ula-panel mt-8 space-y-4 p-6">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        ) : null}
        <div>
          <label className="mb-2 block text-sm font-medium text-dark-700">Current / temporary password</label>
          <PasswordInput
            inputClassName="w-full rounded-xl bg-dark-50 px-3 py-2.5 text-sm ring-1 ring-dark-200"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
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
          <label className="mb-2 block text-sm font-medium text-dark-700">Confirm new password</label>
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
          {pending ? 'Saving…' : 'Continue to workspace'}
        </button>
      </form>
    </div>
  );
}
