import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { homePathForRole } from '../lib/authRedirects';
import { PasswordInput } from '../components/PasswordInput';

type InvitePreview = {
  inviteType?: 'faculty_admin' | 'lecturer';
  email: string;
  fullName: string;
  department: string;
  faculty: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
  requiresOtp: boolean;
};

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { acceptInvite } = useAuth();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api<InvitePreview>(`/api/auth/invite/${encodeURIComponent(token)}`)
      .then((data) => {
        if (data.inviteType === 'lecturer' || data.inviteType === 'faculty_admin' || data.requiresOtp === false) {
          navigate(`/accept-invitation?token=${encodeURIComponent(token)}`, { replace: true });
          return;
        }
        setPreview(data);
      })
      .catch(() => setError('This invitation is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token, navigate]);

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
    if (preview?.requiresOtp && !otp.trim()) {
      setError('Enter the one-time password from your invitation email');
      return;
    }
    setPending(true);
    setError('');
    try {
      const user = await acceptInvite(token, password, preview?.requiresOtp ? otp : undefined);
      navigate(homePathForRole(user.role, user.institution?.slug), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not activate account');
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Invalid invitation</h1>
        <p className="mt-2 text-sm text-slate-500">This link is missing a token. Contact your department administrator.</p>
        <Link to="/?signin=1" className="mt-6 inline-block text-sm font-medium text-[#0f4c81] hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">
        <i className="fa-solid fa-spinner fa-spin mr-2" aria-hidden />
        Loading invitation…
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Invitation unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">{error || 'Ask your administrator to resend the invite.'}</p>
        <Link to="/?signin=1" className="mt-6 inline-block text-sm font-medium text-[#0f4c81]">
          Sign in
        </Link>
      </div>
    );
  }

  const roleLabel =
    preview.inviteType === 'faculty_admin' || preview.role === 'FACULTY_ADMIN'
      ? 'Faculty Administrator'
      : preview.role === 'HOD'
        ? 'Head of Department'
        : 'Lecturer';

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#0f4c81]">ULA · Secure onboarding</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Activate your account</h1>
      <p className="mt-2 text-sm text-slate-600">
        You were invited by <strong>{preview.invitedBy}</strong> to join the academic publishing network.
      </p>

      <div className="ula-panel mt-6 space-y-2 p-5 text-sm">
        <p>
          <span className="text-slate-400">Name</span> · <strong>{preview.fullName}</strong>
        </p>
        <p>
          <span className="text-slate-400">Email</span> · {preview.email}
        </p>
        {preview.inviteType !== 'faculty_admin' ? (
          <p>
            <span className="text-slate-400">Department</span> · {preview.department}
          </p>
        ) : null}
        <p>
          <span className="text-slate-400">Faculty</span> · {preview.faculty}
        </p>
        <p>
          <span className="text-slate-400">Role</span> · {roleLabel}
        </p>
      </div>

      <form onSubmit={onSubmit} className="ula-panel mt-6 space-y-4 p-6">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        ) : null}

        {preview.requiresOtp ? (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">One-time password</label>
            <input
              className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-center text-lg font-bold tracking-[0.25em] uppercase ring-1 ring-slate-200"
              value={otp}
              onChange={(e) => setOtp(e.target.value.toUpperCase())}
              placeholder="From your email"
              required
              autoComplete="one-time-code"
              maxLength={12}
            />
            <p className="mt-1.5 text-xs text-slate-500">Check your invitation email for the 8-character code.</p>
          </div>
        ) : null}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Choose a permanent password</label>
          <PasswordInput
            inputClassName="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Confirm password</label>
          <PasswordInput
            inputClassName="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200"
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
          {pending ? 'Activating…' : 'Activate & sign in'}
        </button>
      </form>
    </div>
  );
}
