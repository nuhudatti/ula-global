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

/** Faculty Admin — faculty logo & tagline only. No personal profile. */
export function FacultyBrandingPanel() {
  const { faculty, refreshScope, updateFaculty } = useBranding();
  const [ctx, setCtx] = useState<SettingsContext['faculty'] | null>(null);
  const [facTagline, setFacTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    const data = await api<SettingsContext>('/api/settings/context');
    if (data.faculty) {
      setCtx(data.faculty);
      setFacTagline(data.faculty.tagline ?? '');
      setLogoUrl(data.faculty.logoUrl);
    }
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
    void refreshScope().catch(() => undefined);
  }, [load, refreshScope]);

  useEffect(() => {
    if (faculty) {
      setLogoUrl(faculty.logoUrl);
    }
  }, [faculty]);

  async function saveTagline() {
    setSaving(true);
    setMsg(null);
    try {
      await api('/api/settings/faculty', {
        method: 'PATCH',
        body: JSON.stringify({ tagline: facTagline }),
      });
      await load();
      await refreshScope();
      setMsg({ type: 'ok', text: 'Faculty tagline saved.' });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  function onUploaded(result: IdentityUploadResult) {
    if (result.faculty) {
      updateFaculty(result.faculty);
      setLogoUrl(result.faculty.logoUrl);
      setCtx((prev) => (prev ? { ...prev, ...result.faculty! } : prev));
    } else if (result.kind === 'logo') {
      setLogoUrl(result.url);
      updateFaculty({ logoUrl: result.url });
    }
  }

  if (!ctx) {
    return <p className="text-sm text-slate-500">Loading faculty branding…</p>;
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
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live preview — faculty logo</p>
        <p className="mt-1 text-sm text-slate-600">
          Institution logo (top) is set by Super Admin. Your faculty logo appears below it in the sidebar.
        </p>
        <div className="mt-4 space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
          <InstitutionBrand variant="sidebar" subtitle="Faculty Admin" accentClass="text-[#0f4c81]" />
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
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Faculty</p>
              <p className="text-sm font-semibold text-slate-800">{ctx.name}</p>
            </div>
          </div>
        </div>
      </div>

      <IdentityImageUpload
        label="Faculty logo"
        hint={`${ctx.name} — shown in the faculty workspace sidebar.`}
        scope="faculty"
        kind="logo"
        entityId={ctx.id}
        currentUrl={logoUrl}
        onUpdated={onUploaded}
      />

      {ctx.canEdit ? (
        <div className="ula-identity-card space-y-3 p-5">
          <label className="text-xs font-semibold text-slate-500">Faculty tagline (text only)</label>
          <input className={fieldCls} value={facTagline} onChange={(e) => setFacTagline(e.target.value)} />
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
