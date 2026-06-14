import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useBranding } from '../../context/BrandingContext';
import type { IdentityUploadResult } from '../../lib/brandingUpload';
import type { SettingsContext } from '../../lib/settings';
import { InstitutionBrand } from '../InstitutionBrand';
import { BrandingImage } from '../BrandingImage';
import { IdentityImageUpload } from './IdentityImageUpload';
import '../../styles/identity-settings.css';
import '../../styles/institution-brand.css';

const fieldCls =
  'w-full rounded-xl border-0 bg-slate-50/90 py-2.5 px-3.5 text-sm text-slate-800 ring-1 ring-slate-200/90 focus:ring-2 focus:ring-[#0f4c81]/40';

/** HOD / Dept Admin — department logo & tagline only. */
export function DepartmentBrandingPanel() {
  const { department, refreshScope, updateDepartment } = useBranding();
  const [ctx, setCtx] = useState<SettingsContext['department'] | null>(null);
  const [deptTagline, setDeptTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    const data = await api<SettingsContext>('/api/settings/context');
    if (data.department) {
      setCtx(data.department);
      setDeptTagline(data.department.tagline ?? '');
      setLogoUrl(data.department.logoUrl);
    }
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
    void refreshScope().catch(() => undefined);
  }, [load, refreshScope]);

  useEffect(() => {
    if (department) {
      setLogoUrl(department.logoUrl);
    }
  }, [department]);

  async function saveTagline() {
    setSaving(true);
    setMsg(null);
    try {
      await api('/api/settings/department', {
        method: 'PATCH',
        body: JSON.stringify({ tagline: deptTagline }),
      });
      await load();
      await refreshScope();
      setMsg({ type: 'ok', text: 'Department tagline saved.' });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  function onUploaded(result: IdentityUploadResult) {
    if (result.department) {
      updateDepartment(result.department);
      setLogoUrl(result.department.logoUrl);
      setCtx((prev) => (prev ? { ...prev, ...result.department! } : prev));
    } else if (result.kind === 'logo') {
      setLogoUrl(result.url);
      updateDepartment({ logoUrl: result.url });
    }
  }

  if (!ctx) {
    return <p className="text-sm text-slate-500">Loading department branding…</p>;
  }

  return (
    <div className="ula-identity-root ula-dept-animate-in space-y-6">
      {msg ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            msg.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {msg.text}
        </div>
      ) : null}

      <div className="ula-identity-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live preview — department logo</p>
        <p className="mt-1 text-sm text-slate-600">
          Your department logo appears in the sidebar under the institution mark for all department staff.
        </p>
        <div className="mt-4 space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
          <InstitutionBrand variant="sidebar" subtitle="Department" accentClass="text-[#0f4c81]" />
          <div className="flex items-center gap-2.5 border-t border-slate-100 pt-3">
            <BrandingImage
              url={logoUrl}
              cacheKey={logoUrl ?? 'none'}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 ring-1 ring-slate-200/80"
              fallback={
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200/80">
                  {ctx.name.charAt(0)}
                </span>
              }
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Department</p>
              <p className="text-sm font-semibold text-slate-800">{ctx.name}</p>
              {ctx.facultyName ? <p className="text-xs text-slate-500">{ctx.facultyName}</p> : null}
            </div>
          </div>
        </div>
      </div>

      <IdentityImageUpload
        label="Department logo"
        hint={`${ctx.name} — shown in the department workspace sidebar.`}
        scope="department"
        kind="logo"
        currentUrl={logoUrl}
        onUpdated={onUploaded}
      />

      {ctx.canEdit ? (
        <div className="ula-identity-card space-y-3 p-5">
          <label className="text-xs font-semibold text-slate-500">Department tagline (text only)</label>
          <input className={fieldCls} value={deptTagline} onChange={(e) => setDeptTagline(e.target.value)} />
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveTagline()}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700"
          >
            Save tagline
          </button>
        </div>
      ) : null}
    </div>
  );
}
