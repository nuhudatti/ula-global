import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { clearFarewell, readFarewell } from '../lib/signOut';
import { normalizeSlugInput } from '../lib/tenant';

const field =
  'w-full rounded-xl border-0 bg-dark-50 py-3 px-4 text-sm text-dark-800 ring-1 ring-dark-200 focus:ring-2 focus:ring-primary-500';

export function InstitutionFinderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const intent = searchParams.get('signin') === '1' ? 'login' : searchParams.get('register') === '1' ? 'register' : 'browse';
  const signedOut = searchParams.get('signedOut') === '1';

  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [farewell, setFarewell] = useState<{ firstName: string } | null>(null);

  useEffect(() => {
    if (signedOut) {
      const f = readFarewell();
      if (f) setFarewell({ firstName: f.firstName });
    }
  }, [signedOut]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const normalized = normalizeSlugInput(slug);
    if (!normalized) {
      setError('Enter your university workspace slug (e.g. ibbul, abu).');
      return;
    }
    clearFarewell();
    const dest =
      intent === 'login'
        ? `/${normalized}/login`
        : intent === 'register'
          ? `/${normalized}/register`
          : `/${normalized}`;
    navigate(dest, { replace: true });
  }

  const heading =
    intent === 'login' ? 'Sign in to your university' : intent === 'register' ? 'Create a student account' : 'Find your university';
  const sub =
    intent === 'login'
      ? 'Enter your institution slug to open its sign-in page.'
      : intent === 'register'
        ? 'Enter your institution slug to open its registration page.'
        : 'Each university has its own workspace. Enter your institution slug to continue.';

  return (
    <div className="mx-auto max-w-lg px-4 py-16 md:py-24">
      {farewell ? (
        <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          You&apos;re signed out, {farewell.firstName}. Enter your university slug below to sign in again.
        </div>
      ) : null}

      <div className="mb-8 text-center">
        <p className="text-2xl font-semibold tracking-tight text-dark-900">
          ULA <span className="text-primary-600">Global</span>
        </p>
        <p className="mt-1 text-sm text-dark-500">Multi-university academic platform</p>
      </div>

      <h1 className="mb-2 text-xl font-semibold text-dark-900">{heading}</h1>
      <p className="mb-8 text-sm leading-relaxed text-dark-600">{sub}</p>

      <form onSubmit={onSubmit} className="ula-panel space-y-4 p-6 md:p-8">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        ) : null}
        <div>
          <label htmlFor="institution-slug" className="mb-2 block text-sm font-medium text-dark-700">
            Institution slug
          </label>
          <input
            id="institution-slug"
            className={field}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. ibbul"
            autoComplete="off"
            autoFocus
            required
          />
          <p className="mt-2 text-[12px] text-dark-400">
            This is the short name in your university URL — <code className="rounded bg-dark-100 px-1">ula.app/ibbul</code>
          </p>
        </div>
        <button
          type="submit"
          className="btn-ula-primary w-full rounded-xl py-3 text-sm font-semibold shadow-sm"
        >
          {intent === 'login' ? 'Continue to sign in' : intent === 'register' ? 'Continue to register' : 'Open workspace'}
        </button>
      </form>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-dark-500">
        <Link to="/?signin=1" className="font-medium text-primary-700 hover:underline">
          Sign in
        </Link>
        <span aria-hidden>·</span>
        <Link to="/?register=1" className="font-medium text-primary-700 hover:underline">
          Register
        </Link>
        <span aria-hidden>·</span>
        <Link to="/platform/login" className="font-medium text-dark-600 hover:underline">
          Platform operations
        </Link>
      </div>
    </div>
  );
}
