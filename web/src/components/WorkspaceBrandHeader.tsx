import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { InstitutionBrand } from './InstitutionBrand';
import { BrandingImage } from './BrandingImage';

/** Unified sidebar header — institution (platform) + optional faculty/department scope */
export function WorkspaceBrandHeader({
  subtitle,
  accentClass = 'text-primary-700',
}: {
  subtitle: string;
  accentClass?: string;
}) {
  const { user } = useAuth();
  const { faculty, department, scopeEpoch } = useBranding();

  let scopeLabel: string | undefined;
  let scopeName: string | undefined;
  let scopeLogoUrl: string | null | undefined;

  if (user?.role === 'FACULTY_ADMIN' && faculty) {
    scopeLabel = 'Faculty';
    scopeName = faculty.name;
    scopeLogoUrl = faculty.logoUrl;
  } else if (
    department &&
    user &&
    ['HOD', 'DEPARTMENT_ADMIN', 'LECTURER', 'STUDENT'].includes(user.role)
  ) {
    scopeLabel = 'Department';
    scopeName = department.name;
    scopeLogoUrl = department.logoUrl;
  }

  const scopeCacheKey = `${scopeEpoch}-${scopeLogoUrl ?? ''}`;

  return (
    <>
      <div className="flex h-[var(--dw-header)] items-center border-b border-slate-200/80 px-5">
        <InstitutionBrand variant="sidebar" subtitle={subtitle} accentClass={accentClass} className="min-w-0 flex-1" />
      </div>
      {scopeLabel && scopeName ? (
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <BrandingImage
              url={scopeLogoUrl}
              cacheKey={scopeCacheKey}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 ring-1 ring-slate-200/80"
              fallback={
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200/80">
                  {scopeName.charAt(0)}
                </span>
              }
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{scopeLabel}</p>
              <p className="truncate text-sm font-semibold text-slate-800">{scopeName}</p>
              {department?.facultyName && user?.role !== 'FACULTY_ADMIN' ? (
                <p className="truncate text-xs text-slate-500">{department.facultyName}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
