const STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  SUSPENDED: 'bg-amber-50 text-amber-900 ring-amber-200',
  ARCHIVED: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function TenantStatusBadge({ status }: { status: string }) {
  const key = status.toUpperCase();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${STYLES[key] ?? STYLES.ARCHIVED}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${key === 'ACTIVE' ? 'bg-emerald-500' : key === 'SUSPENDED' ? 'bg-amber-500' : 'bg-slate-400'}`}
        aria-hidden
      />
      {status.toLowerCase()}
    </span>
  );
}
