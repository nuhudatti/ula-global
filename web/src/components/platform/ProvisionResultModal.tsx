type ProvisionResult = {
  institution: { slug: string; name: string };
  adminEmail: string;
  adminName: string;
  loginUrl: string;
  invitationUrl?: string;
  inviteUrl?: string;
  devActivationUrl?: string;
  emailSent: boolean;
  emailMode?: string;
  invitationStatus?: string;
};

export function ProvisionResultModal({
  result,
  onClose,
  title = 'Institution provisioned',
  subtitle = 'An invitation email was',
}: {
  result: ProvisionResult;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}) {
  const setupLink = result.invitationUrl || result.devActivationUrl || '';

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="ula-platform-kpi max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">{title}</p>
        <h3 className="mt-1 text-xl font-semibold text-slate-900">{result.institution.name}</h3>
        <p className="mt-2 text-sm text-slate-500">
          {subtitle}{' '}
          {result.emailSent ? (
            <span className="font-medium text-slate-700">sent to the administrator&apos;s email</span>
          ) : (
            <span className="font-medium text-amber-800">
              written to the dev email outbox ({result.emailMode || 'outbox'})
            </span>
          )}
          .
        </p>

        <dl className="mt-5 space-y-4 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Workspace</dt>
            <dd className="mt-1 flex items-center justify-between gap-2 font-mono text-slate-800">
              /{result.institution.slug}
              <button type="button" onClick={() => void copy(`/${result.institution.slug}`)} className="text-xs text-slate-500 hover:text-slate-800">
                Copy
              </button>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Administrator</dt>
            <dd className="mt-1 text-slate-800">{result.adminName}</dd>
            <dd className="font-mono text-slate-600">{result.adminEmail}</dd>
          </div>
          {setupLink ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Secure setup link</dt>
              <dd className="mt-2 break-all font-mono text-xs text-emerald-950">{setupLink}</dd>
              <button
                type="button"
                onClick={() => void copy(setupLink)}
                className="mt-3 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900"
              >
                Copy invitation link
              </button>
              <p className="mt-2 text-xs text-emerald-800">
                The administrator uses this link to choose their password. Status:{' '}
                <strong>{result.invitationStatus?.toLowerCase() || 'pending'}</strong>.
              </p>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Login URL (after setup)</dt>
            <dd className="mt-1 flex items-center justify-between gap-2 break-all font-mono text-slate-800">
              {result.loginUrl}
              <button type="button" onClick={() => void copy(result.loginUrl)} className="shrink-0 text-xs text-slate-500 hover:text-slate-800">
                Copy
              </button>
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          {setupLink ? (
            <a
              href={setupLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Open setup link
            </a>
          ) : null}
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
