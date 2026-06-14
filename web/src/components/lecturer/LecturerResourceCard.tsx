import { fileExt, formatBytes } from '../../lib/format';
import { kindLabel, type LecturerResource } from '../../lib/lecturer';
import { themeForKind } from '../../lib/resourceThemes';

type Props = {
  resource: LecturerResource;
  onOpen: (resource: LecturerResource) => void;
};

export function LecturerResourceCard({ resource: r, onOpen }: Props) {
  const theme = themeForKind(r.kind);
  const session = r.examYear ? `${r.examYear}/${r.examYear + 1}` : 'Current';

  return (
    <article className="ula-lecturer-resource-card group flex flex-col p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${theme.badge}`}>
            <i className={`fa-solid ${theme.iconClass} text-[9px]`} aria-hidden />
            {kindLabel(r.kind)}
          </span>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-primary-700">{r.course.code}</p>
          <h3 className="mt-1 text-[16px] font-semibold leading-snug tracking-tight text-dark-900">{r.title}</h3>
          <p className="mt-0.5 truncate text-[13px] text-dark-500">{r.course.title}</p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-100">
          Live
        </span>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-[12px]">
        <div className="rounded-xl bg-dark-50/90 px-2 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-dark-400">Downloads</p>
          <p className="mt-0.5 font-semibold tabular-nums text-dark-800">{r.downloadCount.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-dark-50/90 px-2 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-dark-400">Rating</p>
          <p className="mt-0.5 font-semibold tabular-nums text-dark-800">
            {r.ratingCount > 0 ? r.avgRating.toFixed(1) : '—'}
          </p>
        </div>
        <div className="rounded-xl bg-dark-50/90 px-2 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-dark-400">File</p>
          <p className="mt-0.5 truncate font-semibold text-dark-800">{fileExt(r.originalFileName)}</p>
        </div>
      </div>

      <p className="mb-4 text-[12px] text-dark-400">
        {new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })} · Session {session} ·{' '}
        {formatBytes(r.sizeBytes)}
      </p>

      <button
        type="button"
        onClick={() => onOpen(r)}
        className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-800 py-2.5 text-[13px] font-semibold text-white transition hover:bg-primary-900 group-hover:shadow-[0_4px_14px_rgba(20,83,45,0.2)]"
      >
        <i className="fa-regular fa-folder-open text-[12px]" aria-hidden />
        View details
      </button>
    </article>
  );
}
