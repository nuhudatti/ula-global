import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useBranding } from '../../context/BrandingContext';
import type { InstitutionPublic, LogoPlacement } from '../../lib/settings';
import { InstitutionBrand } from '../InstitutionBrand';
import { InstitutionPublicBanner } from '../InstitutionPublicBanner';
import { IdentityImageUpload } from './IdentityImageUpload';
import '../../styles/identity-settings.css';
import '../../styles/institution-brand.css';

const fieldCls =
  'w-full rounded-xl border-0 bg-slate-50/90 py-2.5 px-3.5 text-sm text-slate-800 ring-1 ring-slate-200/90 focus:ring-2 focus:ring-[#0f4c81]/40';

/** Super Admin — institution logo, banner & name. No personal profile. */
export function InstitutionBrandingPanel() {
  const { institution, updateInstitution, refreshInstitution } = useBranding();
  const [instName, setInstName] = useState('');
  const [instShort, setInstShort] = useState('IBBUL');
  const [instTagline, setInstTagline] = useState('');
  const [instPlacement, setInstPlacement] = useState<LogoPlacement>('left');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const syncFromInstitution = useCallback((inst: InstitutionPublic | null) => {
    if (!inst) return;
    setInstName(inst.name);
    setInstShort(inst.shortName || 'IBBUL');
    setInstTagline(inst.tagline ?? '');
    setInstPlacement(inst.logoPlacement === 'right' ? 'right' : 'left');
    setLogoUrl(inst.logoUrl);
    setBannerUrl(inst.bannerUrl);
  }, []);

  useEffect(() => {
    syncFromInstitution(institution);
  }, [institution, syncFromInstitution]);

  useEffect(() => {
    void refreshInstitution().catch(() => undefined);
  }, [refreshInstitution]);

  async function saveDetails() {
    setSaving(true);
    setMsg(null);
    try {
      const inst = await api<InstitutionPublic>('/api/settings/institution', {
        method: 'PATCH',
        body: JSON.stringify({
          name: instName,
          shortName: instShort,
          tagline: instTagline,
          logoPlacement: instPlacement,
        }),
      });
      updateInstitution(inst);
      syncFromInstitution(inst);
      setMsg({ type: 'ok', text: 'Institution name and tagline saved.' });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  function onLogoUploaded(result: { url: string | null; institution?: InstitutionPublic | null }) {
    if (result.institution) {
      updateInstitution(result.institution);
      syncFromInstitution(result.institution);
    } else if (result.url) {
      setLogoUrl(result.url);
      updateInstitution({ logoUrl: result.url });
    }
  }

  function onBannerUploaded(result: { url: string | null; institution?: InstitutionPublic | null }) {
    if (result.institution) {
      updateInstitution(result.institution);
      syncFromInstitution(result.institution);
    } else if (result.url !== undefined) {
      setBannerUrl(result.url);
      updateInstitution({ bannerUrl: result.url });
    }
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
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live preview</p>
        <p className="mt-1 text-sm text-slate-600">
          How learners and staff see your institution on browse, sign-in, and register.
        </p>
        <div className="ula-inst-branding-preview-frame mt-4">
          <div className="ula-inst-branding-preview-frame__chrome">
            <span className="ula-inst-branding-preview-frame__dot" />
            <span className="ula-inst-branding-preview-frame__dot" />
            <span className="ula-inst-branding-preview-frame__dot" />
            <span className="ml-2 text-[10px] font-medium text-slate-400">Public pages</span>
          </div>
          <InstitutionPublicBanner variant="hero" urlOverride={bannerUrl} />
          <div className="flex items-center justify-center border-b border-slate-100 bg-white px-4 py-3">
            <InstitutionBrand
              variant="auth"
              accentClass="text-[#0f4c81]"
              placementOverride={instPlacement}
              shortNameOverride={instShort}
              taglineOverride={instTagline}
              logoUrlOverride={logoUrl}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <IdentityImageUpload
          label="Institution logo"
          hint="Appears in navigation, workspaces, and sign-in. Upload saves instantly."
          scope="institution"
          kind="logo"
          currentUrl={logoUrl}
          onUpdated={onLogoUploaded}
        />
        <IdentityImageUpload
          label="Institution banner"
          hint="Wide image on browse, sign-in, and register. Recommended 1600×400 px."
          scope="institution"
          kind="banner"
          aspect="wide"
          currentUrl={bannerUrl}
          onUpdated={onBannerUploaded}
        />
      </div>

      <div className="ula-identity-card space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold text-slate-900">Institution details</p>
          <p className="mt-0.5 text-xs text-slate-500">Text fields — use Save to apply. Images save on upload.</p>
        </div>
        <input className={fieldCls} value={instName} onChange={(e) => setInstName(e.target.value)} placeholder="Full institution name" />
        <input className={fieldCls} value={instShort} onChange={(e) => setInstShort(e.target.value)} placeholder="Short name (e.g. IBBUL)" />
        <input className={fieldCls} value={instTagline} onChange={(e) => setInstTagline(e.target.value)} placeholder="Tagline" />
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Logo placement</p>
          <div className="ula-inst-placement-picker">
            {(['left', 'right'] as const).map((side) => (
              <button
                key={side}
                type="button"
                data-active={instPlacement === side}
                className="ula-inst-placement-option"
                onClick={() => {
                  setInstPlacement(side);
                  updateInstitution({ logoPlacement: side });
                }}
              >
                <span className="ula-inst-placement-option__preview" data-side={side}>
                  {side === 'left' ? (
                    <>
                      <span className="ula-inst-placement-option__dot" />
                      <span>Title</span>
                    </>
                  ) : (
                    <>
                      <span>Title</span>
                      <span className="ula-inst-placement-option__dot" />
                    </>
                  )}
                </span>
                <span className="text-[11px] font-semibold capitalize text-slate-700">{side}</span>
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveDetails()}
          className="rounded-xl bg-[#0f4c81] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save institution details
        </button>
      </div>
    </div>
  );
}
