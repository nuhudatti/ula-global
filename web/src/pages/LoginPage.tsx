import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTenantPaths } from '../hooks/useTenantPaths';
import { homePathForRole } from '../lib/authRedirects';
import { clearFarewell, readFarewell, storeLastInstitutionSlug } from '../lib/signOut';
import { PasswordInput } from '../components/PasswordInput';
import { InstitutionBrand } from '../components/InstitutionBrand';
import '../styles/institution-brand.css';
import '../styles/campus-pulse.css';

const field =
  'w-full rounded-xl border-0 bg-dark-50 py-2.5 px-3 text-sm text-dark-800 ring-1 ring-dark-200 focus:ring-2 focus:ring-primary-500';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams();
  const paths = useTenantPaths();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const from = (location.state as { from?: string } | null)?.from || '/';
  const signedOut = searchParams.get('signedOut') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [farewell, setFarewell] = useState<{ firstName: string } | null>(null);

  useEffect(() => {
    if (signedOut) {
      const f = readFarewell();
      if (f) setFarewell({ firstName: f.firstName });
    }
  }, [signedOut]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setPending(true);
    clearFarewell();
    setFarewell(null);
    try {
      const { user: u, mustChangePassword } = await login(email, password);
      if (u.institution?.slug) storeLastInstitutionSlug(u.institution.slug);
      if (mustChangePassword) {
        navigate('/change-password', { replace: true });
        return;
      }
      const home = homePathForRole(u.role, u.institution?.slug);
      const tenantBase = tenantSlug ? `/${tenantSlug}` : '';
      const tenantHome =
        home === '/admin' && tenantSlug
          ? `${tenantBase}/admin`
          : home === '/' && tenantSlug
            ? tenantBase
            : home;
      navigate(tenantHome !== '/' ? tenantHome : from && from !== '/login' ? from : tenantBase || '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="ula-auth-shell flex items-center justify-center px-4 py-12 md:py-16">
      <div className="mx-auto w-full max-w-md">
        {farewell ? (
          <div className="ula-auth-farewell" role="status">
            <p className="ula-auth-farewell__title">
              <i className="fa-solid fa-circle-check" aria-hidden />
              You&apos;re signed out, {farewell.firstName}
            </p>
            <p className="ula-auth-farewell__text">
              Your session ended securely. Sign in again to access your dashboard, ratings, and course discussions.
            </p>
          </div>
        ) : null}

        <div className="mb-8 flex justify-center">
          <InstitutionBrand variant="auth" accentClass="text-primary-600" />
        </div>

        <h1 className="text-center text-2xl font-semibold tracking-tight text-dark-900">Welcome back</h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-dark-500">
          Sign in to your materials, ratings, and course discussions.
        </p>

        <div className="ula-auth-trust justify-center">
          <span className="ula-auth-trust__chip">
            <i className="fa-solid fa-shield-halved text-primary-600" aria-hidden />
            Secure
          </span>
          <span className="ula-auth-trust__chip">
            <i className="fa-solid fa-star text-amber-500" aria-hidden />
            Rate when signed in
          </span>
        </div>

        <form onSubmit={onSubmit} className="ula-panel mt-8 space-y-4 p-6 md:p-8">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
          ) : null}
          <div>
            <label className="mb-2 block text-sm font-medium text-dark-700">Email or matric number</label>
            <input
              className={field}
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="you@ibbul.edu or CSC/22/0123"
              required
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-dark-700">Password</label>
              <Link to={paths.forgotPassword} className="text-xs font-medium text-primary-700 hover:underline">
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              inputClassName={field}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="btn-ula-primary w-full rounded-xl py-3 text-sm font-semibold shadow-sm disabled:opacity-50"
          >
            {pending ? 'Signing you in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-dark-500">
          New student?{' '}
          <Link to={paths.register} className="font-medium text-primary-700 hover:underline">
            Create your account
          </Link>
        </p>

        <Link
          to={paths.home}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-dark-200 bg-white py-3 text-sm font-semibold text-dark-700 shadow-sm transition hover:border-dark-300 hover:bg-dark-50"
        >
          <i className="fa-solid fa-arrow-left text-[12px]" aria-hidden />
          Back to browse materials
        </Link>
      </div>
    </div>
  );
}
