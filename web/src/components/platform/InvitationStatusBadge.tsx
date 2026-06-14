const TONE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-800',
  RESENT: 'bg-sky-50 text-sky-800',
  ACCEPTED: 'bg-emerald-50 text-emerald-800',
  EXPIRED: 'bg-slate-100 text-slate-600',
  REVOKED: 'bg-red-50 text-red-700',
};

const LABEL: Record<string, string> = {
  PENDING: 'Pending',
  RESENT: 'Resent',
  ACCEPTED: 'Accepted',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
};

export function InvitationStatusBadge({ status }: { status: string }) {
  const key = status?.toUpperCase() || 'PENDING';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TONE[key] ?? TONE.PENDING}`}>
      {LABEL[key] ?? key}
    </span>
  );
}
