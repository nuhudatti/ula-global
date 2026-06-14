import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { homePathForRole } from '../lib/authRedirects';
import { PasswordInput } from '../components/PasswordInput';
import { InstitutionBrand } from '../components/InstitutionBrand';
import { useTenantPaths } from '../hooks/useTenantPaths';
import '../styles/institution-brand.css';

type InvitationPreview = {
  inviteType: 'lecturer' | 'faculty_admin' | 'institution_admin' | 'arm';
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  department: string;
  faculty?: string;
  institution?: string;
  institutionSlug?: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
  requiresOtp: false;
};

type InvitationError = {
  error: string;
  status?: string;
};

export function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const paths = useTenantPaths();
  const { establishSession } = useAuth();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [errorState, setErrorState] = useState<InvitationError | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api<InvitationPreview>(`/api/auth/invitation/${encodeURIComponent(token)}`)
      .then((data) => {
        setPreview(data);
        setFirstName(data.firstName || '');
        setLastName(data.lastName || '');
      })
      .catch(async (err) => {
        const msg = err instanceof Error ? err.message : 'This invitation is invalid.';
        setErrorState({ error: msg });
      })
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
      const res = await api<{ token: string; user: { role: string; institution?: { slug: string } | null } }>(
        '/api/auth/accept-invitation',
        {
          method: 'POST',
          body: JSON.stringify({ token, password, firstName, lastName }),
        },
      );
      establishSession(res.token, res.user as Parameters<typeof establishSession>[1]);
      navigate(homePathForRole(res.user.role, res.user.institution?.slug), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete setup');
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div className="ula-auth-shell mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Invalid invitation</h1>
        <p className="mt-2 text-sm text-slate-500">This link is missing a token. Contact your department administrator.</p>
        <Link to={paths.login} className="mt-6 inline-block text-sm font-medium text-[#0f4c81] hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="ula-auth-shell mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">
        <i className="fa-solid fa-spinner fa-spin mr-2" aria-hidden />
        Verifying your invitation…
      </div>
    );
  }

  if (!preview) {
    const status = errorState?.status;
    const title =
      status === 'ACCEPTED'
        ? 'Invitation already accepted'
        : status === 'CANCELLED' || status === 'REVOKED'
          ? 'Invitation cancelled'
          : status === 'EXPIRED'
            ? 'Invitation expired'
            : 'Invitation unavailable';
    return (
      <div className="ula-auth-shell mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <i className="fa-solid fa-envelope-circle-check text-xl" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {errorState?.error || 'Ask your department administrator to resend or share a new invitation link.'}
        </p>
        {status === 'ACCEPTED' ? (
          <Link to={paths.login} className="mt-6 inline-block rounded-xl bg-[#0f4c81] px-5 py-2.5 text-sm font-semibold text-white">
            Sign in
          </Link>
        ) : (
          <p className="mt-4 text-xs text-slate-400">Active lecturers can use Forgot Password on the sign-in page.</p>
        )}
      </div>
    );
  }

  const roleLabel =
    preview.role === 'INSTITUTION_ADMIN'
      ? 'Institution Administrator'
      : preview.role === 'ACADEMIC_RESOURCES_MANAGER'
        ? 'Academic Resources Manager'
      : preview.role === 'HOD'
      ? 'Head of Department'
      : preview.role === 'FACULTY_ADMIN'
        ? 'Faculty Administrator'
        : 'Lecturer';
  const expiry = new Date(preview.expiresAt).toLocaleDateString('en-GB', { dateStyle: 'long' });

  return (
    <div className="ula-auth-shell flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <InstitutionBrand variant="auth" accentClass="text-primary-600" />
        </div>

        <p className="text-center text-xs font-semibold uppercase tracking-wide text-[#0f4c81]">Secure onboarding</p>
        <h1 className="mt-2 text-center text-2xl font-semibold text-slate-900">Accept your invitation</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          {preview.institution ? (
            <>
              Join <strong>{preview.institution}</strong> as a {roleLabel.toLowerCase()}.
            </>
          ) : (
            <>Create your password to activate your {roleLabel.toLowerCase()} account.</>
          )}
        </p>

        <div className="ula-panel mt-6 space-y-2 p-5 text-sm">
          <p>
            <span className="text-slate-400">Invited by</span> · <strong>{preview.invitedBy}</strong>
          </p>
          <p>
            <span className="text-slate-400">Email</span> · {preview.email}
          </p>
          <p>
            <span className="text-slate-400">{preview.role === 'INSTITUTION_ADMIN' || preview.role === 'ACADEMIC_RESOURCES_MANAGER' ? 'Workspace' : 'Department'}</span> · {preview.department}
          </p>
          {preview.faculty ? (
            <p>
              <span className="text-slate-400">Faculty</span> · {preview.faculty}
            </p>
          ) : null}
          <p className="text-xs text-slate-500">Link expires {expiry}</p>
        </div>

        <form onSubmit={onSubmit} className="ula-panel mt-6 space-y-4 p-6">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">First name</label>
              <input
                className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Last name</label>
              <input
                className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Create password</label>
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
            {pending ? 'Creating account…' : 'Accept invitation & sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
