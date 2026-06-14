import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { AdminFacultyRow } from '../../lib/adminFaculties';
import { adminFacultyUrl } from '../../lib/facultyScope';

/** Switch which faculty the institutional admin is managing (platform admin only). */
export function FacultySwitcher({
  currentFacultyId,
  currentFacultyName,
  className = '',
}: {
  currentFacultyId: string | null;
  currentFacultyName?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const [faculties, setFaculties] = useState<AdminFacultyRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void api<AdminFacultyRow[]>('/api/admin/faculties')
      .then(setFaculties)
      .catch(() => {});
  }, []);

  const label = currentFacultyName || faculties.find((f) => f.id === currentFacultyId)?.name || 'All faculties';

  function pick(id: string | null) {
    setOpen(false);
    navigate(id ? adminFacultyUrl(id) : '/admin');
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex w-full max-w-[240px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <i className="fa-solid fa-school text-primary-700" aria-hidden />
        <span className="truncate">{label}</span>
        <i className={`fa-solid fa-chevron-down ml-auto text-[10px] text-slate-400 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close faculty menu"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            className="absolute left-0 z-50 mt-2 max-h-64 w-full min-w-[240px] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
          >
            <li>
              <button
                type="button"
                onClick={() => pick(null)}
                className={`w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${
                  !currentFacultyId ? 'bg-primary-50 font-medium text-primary-900' : 'text-slate-700'
                }`}
              >
                All faculties (platform view)
              </button>
            </li>
            {faculties.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={f.id === currentFacultyId}
                  onClick={() => pick(f.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${
                    f.id === currentFacultyId ? 'bg-primary-50 text-primary-900' : 'text-slate-800'
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                    {f.name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{f.name}</span>
                    <span className="block text-[10px] text-slate-400">{f.code}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
