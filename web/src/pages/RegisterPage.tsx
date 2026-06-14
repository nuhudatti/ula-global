import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useInstitutionSlug } from '../hooks/useInstitutionSlug';
import { useTenantPaths } from '../hooks/useTenantPaths';
import { PasswordInput } from '../components/PasswordInput';
import { InstitutionBrand } from '../components/InstitutionBrand';
import '../styles/institution-brand.css';

const field =
  'w-full rounded-xl border-0 bg-dark-50 py-2.5 px-3 text-sm text-dark-800 ring-1 ring-dark-200 focus:ring-2 focus:ring-primary-500';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const institutionSlug = useInstitutionSlug();
  const paths = useTenantPaths();

  const [fullName, setFullName] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<{ id: string; name: string; faculty: { name: string } }[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setDepartments([]);
    setDepartmentId('');
    api<{ id: string; name: string; faculty: { name: string } }[]>('/api/meta/departments')
      .then(setDepartments)
      .catch(() => {});
  }, [institutionSlug]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain at least one letter and one number.');
      return;
    }
    setPending(true);
    try {
      await register(email, password, fullName, departmentId, matricNumber);
      navigate(paths.home);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 md:py-16">
      <div className="mb-8 flex justify-center">
        <InstitutionBrand variant="auth" accentClass="text-primary-600" />
      </div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-dark-900">Create student account</h1>
      <p className="mb-8 text-sm leading-relaxed text-dark-600">
        Staff accounts are issued by administrators. Public sign-up is for students only.
      </p>

      <form onSubmit={onSubmit} className="ula-panel space-y-4 p-6 md:p-8">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        )}
        <div>
          <label className="mb-2 block text-sm font-medium text-dark-700">Full name</label>
          <input className={field} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-dark-700">Department</label>
          <select
            className={field}
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            required
          >
            <option value="">Select your department…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.faculty.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-dark-700">Matric number</label>
          <input
            className={field}
            value={matricNumber}
            onChange={(e) => setMatricNumber(e.target.value.toUpperCase())}
            placeholder="e.g. CSC/22/0123"
            pattern="[A-Za-z0-9/_-]{4,30}"
            title="Letters, numbers, / and - only"
            autoComplete="off"
            required
          />
          <p className="mt-1.5 text-[12px] text-dark-400">Your official IBBUL matric number — used on all submissions.</p>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-dark-700">Email</label>
          <input
            className={field}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-dark-700">Password</label>
          <PasswordInput
            inputClassName={field}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="btn-ula-primary w-full rounded-xl py-3 text-sm font-semibold shadow-sm disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Register'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-dark-500">
        Already have an account?{' '}
        <Link to={paths.login} className="font-medium text-primary-700 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
