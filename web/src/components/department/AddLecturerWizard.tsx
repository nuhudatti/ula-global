import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { useInstitutionSlug } from '../../hooks/useInstitutionSlug';

const STEPS = ['Identity', 'Access & invite'] as const;

const inputCls =
  'w-full rounded-xl border-0 bg-slate-50/90 py-2.5 px-3.5 text-sm text-slate-800 ring-1 ring-slate-200/90 focus:ring-2 focus:ring-[#0f4c81]/40';
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500';

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

export function AddLecturerWizard({ onClose, onSuccess }: Props) {
  const institutionSlug = useInstitutionSlug();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<{
    inviteUrl: string;
    emailSent?: boolean;
    emailError?: string | null;
    mode: 'invite' | 'direct';
  } | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [staffId, setStaffId] = useState('');
  const [canUpload, setCanUpload] = useState(true);
  const [sendInvite, setSendInvite] = useState(true);
  const [tempPassword, setTempPassword] = useState('');

  function next() {
    if (step === 0) {
      if (!fullName.trim() || !email.trim()) {
        setError('Full name and institutional email are required.');
        return;
      }
    }
    setError(null);
    setStep(1);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await api<{
        type: string;
        inviteUrl?: string;
        devActivationUrl?: string;
        emailSent?: boolean;
        emailError?: string | null;
      }>('/api/department/lecturers', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          staffId,
          departmentRole: 'LECTURER',
          canUpload,
          courseIds: [],
          mode: sendInvite ? 'invite' : 'direct',
          password: tempPassword || undefined,
          accountStatus: 'ACTIVE',
        }),
      });
      if (res.type === 'invite' && res.inviteUrl) {
        setInviteResult({
          inviteUrl: res.devActivationUrl || `${window.location.origin}${res.inviteUrl}`,
          emailSent: res.emailSent,
          emailError: res.emailError,
          mode: 'invite',
        });
      } else if (res.type === 'direct') {
        const loginPath = institutionSlug ? `/${institutionSlug}/login` : '/?signin=1';
        setInviteResult({
          inviteUrl: `${window.location.origin}${loginPath}`,
          emailSent: res.emailSent,
          emailError: res.emailError,
          mode: 'direct',
        });
      } else {
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add lecturer');
    } finally {
      setPending(false);
    }
  }

  if (inviteResult) {
    return (
      <div className="ula-dept-surface max-w-xl p-8 text-center animate-in">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <i className="fa-solid fa-paper-plane text-2xl" aria-hidden />
        </div>
        <h3 className="text-xl font-semibold text-slate-900">
          {inviteResult.mode === 'invite' ? 'Invitation created' : 'Account created'}
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          {inviteResult.mode === 'invite'
            ? inviteResult.emailSent
              ? `A secure invitation email was sent to ${email}. The link expires in 7 days and can only be used once.`
              : `Email could not be sent${inviteResult.emailError ? ` (${inviteResult.emailError})` : ''} — copy the invitation link below and share it via WhatsApp, SMS, or email.`
            : `Account created for ${email}. Share the sign-in link if needed.`}
        </p>
        {inviteResult.mode === 'invite' && !inviteResult.emailSent ? (
          <p className="mt-2 text-xs text-slate-500">
            Dev copy saved in <code className="rounded bg-slate-100 px-1">data/email-outbox/</code>.
          </p>
        ) : null}
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-left text-xs break-all text-slate-700 ring-1 ring-slate-200">
          {inviteResult.inviteUrl}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className="rounded-xl bg-[#0f4c81] px-5 py-2.5 text-sm font-semibold text-white"
            onClick={() => void navigator.clipboard.writeText(inviteResult.inviteUrl)}
          >
            Copy invitation link
          </button>
          <button
            type="button"
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200"
            onClick={() => {
              onSuccess();
              onClose();
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ula-dept-surface overflow-hidden max-w-2xl">
      <div className="border-b border-slate-100 px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0f4c81]">Add lecturer</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Onboard a publisher</h2>
        <p className="mt-1 text-sm text-slate-500">
          Identity and access only — courses are created automatically when they publish.
        </p>
        <div className="mt-4 flex gap-6">
          {STEPS.map((label, i) => (
            <div key={label} className="ula-dept-wizard-step" data-active={i === step} data-done={i < step}>
              <span>{i < step ? <i className="fa-solid fa-check text-xs" /> : i + 1}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={step === 1 ? submit : (e) => e.preventDefault()} className="px-6 py-6">
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        {step === 0 ? (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Full name</label>
              <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Institutional email</label>
              <input
                className={inputCls}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@ibbul.edu"
                required
              />
            </div>
            <div>
              <label className={labelCls}>Staff ID (optional)</label>
              <input className={inputCls} value={staffId} onChange={(e) => setStaffId(e.target.value)} placeholder="LEC-001" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
              <input
                type="checkbox"
                checked={canUpload}
                onChange={(e) => setCanUpload(e.target.checked)}
                className="mt-1 rounded border-slate-300"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-800">Can publish materials</span>
                <span className="text-xs text-slate-500">
                  Trusted lecturers — uploads go live immediately in the department catalogue.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} className="mt-1" />
              <span>
                <span className="block text-sm font-semibold text-slate-800">Email invitation link</span>
                <span className="text-xs text-slate-500">Recommended — secure onboarding to lecturer workspace.</span>
              </span>
            </label>
            {!sendInvite ? (
              <div>
                <label className={labelCls}>Temporary password</label>
                <input
                  className={inputCls}
                  type="password"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  minLength={8}
                />
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-8 flex justify-between gap-3 border-t border-slate-100 pt-6">
          <button
            type="button"
            onClick={step === 0 ? onClose : () => setStep(0)}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step === 0 ? (
            <button type="button" onClick={next} className="rounded-xl bg-[#0f4c81] px-6 py-2.5 text-sm font-semibold text-white">
              Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-[#0f4c81] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? 'Processing…' : sendInvite ? 'Send invitation' : 'Create account'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
