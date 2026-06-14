import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { performSignOut } from '../../lib/signOut';
import type { SettingsContext } from '../../lib/settings';
import { defaultIdentityTab, identityPanelTitle, resolveIdentityScopes } from '../../lib/identityScopes';
import { profileContextFromUser } from '../../lib/profileContext';
import { resolveImageUrl } from '../../lib/mediaUrl';
import { IdentityImageUpload } from './IdentityImageUpload';
import { IdentityAvatar } from '../IdentityAvatar';
import { InstitutionBrand } from '../InstitutionBrand';
import { BrandingImage } from '../BrandingImage';
import { useBranding } from '../../context/BrandingContext';
import type { IdentityUploadResult } from '../../lib/brandingUpload';
import { patchSettingsContext } from '../../lib/brandingSync';
import type { InstitutionPublic, LogoPlacement } from '../../lib/settings';
import '../../styles/identity-settings.css';
import '../../styles/institution-brand.css';

const fieldCls =
  'w-full rounded-xl border-0 bg-slate-50/90 py-2.5 px-3.5 text-sm text-slate-800 ring-1 ring-slate-200/90 focus:ring-2 focus:ring-[#0f4c81]/40';

type Tab = 'profile' | 'department' | 'faculty' | 'institution';

export function IdentitySettingsPanel({
  variant = 'auto',
  facultyIdOverride,
}: {
  variant?: 'lecturer' | 'department' | 'department-only' | 'faculty' | 'faculty-scoped' | 'institution-only' | 'auto';
  facultyIdOverride?: string | null;
}) {
  const { user, loading: authLoading, logout, refresh: refreshAuth } = useAuth();
  const { refreshInstitution, refreshScope, updateInstitution } = useBranding();
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<SettingsContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('profile');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [deptTagline, setDeptTagline] = useState('');
  const [facTagline, setFacTagline] = useState('');
  const [instName, setInstName] = useState('');
  const [instShort, setInstShort] = useState('');
  const [instTagline, setInstTagline] = useState('');
  const [instPlacement, setInstPlacement] = useState<LogoPlacement>('left');

  const applyContext = useCallback((data: SettingsContext) => {
    setCtx(data);
    setFullName(data.profile.fullName);
    setBio(data.profile.bio ?? '');
    setDeptTagline(data.department?.tagline ?? '');
    setFacTagline(data.faculty?.tagline ?? '');
    setInstName(data.institution?.name ?? '');
    setInstShort(data.institution?.shortName ?? 'IBBUL');
    setInstTagline(data.institution?.tagline ?? '');
    setInstPlacement(data.institution?.logoPlacement === 'right' ? 'right' : 'left');
  }, []);

  const load = useCallback(async (opts?: { keepMessage?: boolean }) => {
    const path =
      facultyIdOverride
        ? `/api/settings/context?facultyId=${encodeURIComponent(facultyIdOverride)}`
        : '/api/settings/context';
    const data = await api<SettingsContext>(path);
    if (!data.scopes) {
      data.scopes = { profile: true, department: false, faculty: false, institution: false };
    }
    applyContext(data);
    if (!opts?.keepMessage) setMsg(null);
  }, [applyContext, facultyIdOverride]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setMsg({ type: 'err', text: 'Sign in to manage your profile.' });
      return;
    }
    setLoading(true);
    void load()
      .catch(() => {
        applyContext(profileContextFromUser(user));
        setMsg({
          type: 'err',
          text: 'Could not reach settings server. Showing your profile from session — save again or retry.',
        });
      })
      .finally(() => setLoading(false));
  }, [authLoading, user, load, applyContext]);

  const scopes = useMemo(() => resolveIdentityScopes(ctx, variant), [ctx, variant]);

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'profile', label: 'Personal', show: scopes.profile },
    { id: 'department', label: 'Department', show: scopes.department && !!ctx?.department },
    { id: 'faculty', label: 'Faculty', show: scopes.faculty && !!ctx?.faculty },
    { id: 'institution', label: 'Institution', show: scopes.institution && !!ctx?.institution },
  ];

  const visibleTabs = tabs.filter((t) => t.show);
  const personalOnly = visibleTabs.length === 1 && visibleTabs[0]?.id === 'profile';
  const showPersonalHero =
    scopes.profile && variant !== 'institution-only' && variant !== 'department-only';

  useEffect(() => {
    if (!ctx) return;
    setTab(defaultIdentityTab(scopes, variant));
  }, [variant, ctx?.profile.id, scopes.department, scopes.faculty, scopes.institution]);

  async function saveProfile() {
    setSaving(true);
    setMsg(null);
    try {
      await api('/api/settings/profile', {
        method: 'PATCH',
        body: JSON.stringify({ fullName, bio }),
      });
      await load();
      await refreshAuth();
      setMsg({ type: 'ok', text: 'Profile updated.' });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  async function saveDept() {
    setSaving(true);
    try {
      await api('/api/settings/department', { method: 'PATCH', body: JSON.stringify({ tagline: deptTagline }) });
      await load();
      await refreshScope();
      setMsg({ type: 'ok', text: 'Department details saved.' });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  async function saveFac() {
    setSaving(true);
    try {
      await api('/api/settings/faculty', {
        method: 'PATCH',
        body: JSON.stringify({
          tagline: facTagline,
          ...(facultyIdOverride ? { facultyId: facultyIdOverride } : {}),
        }),
      });
      await load();
      if (!facultyIdOverride) await refreshScope();
      setMsg({ type: 'ok', text: 'Faculty tagline saved. Logo changes apply when you upload above.' });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  async function saveInst() {
    setSaving(true);
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
      await load();
      await refreshInstitution();
      await refreshScope();
      setMsg({ type: 'ok', text: 'Institution details saved across the platform.' });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  function handleImageUpload(result: IdentityUploadResult) {
    if (!ctx) return;
    setCtx(patchSettingsContext(ctx, result));
    void load({ keepMessage: true }).catch(() => undefined);
  }

  if (loading) {
    return (
      <div className="ula-identity-root space-y-4">
        <div className="ula-dept-skeleton h-32 rounded-2xl" />
        <div className="ula-dept-skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  if (!ctx) {
    return <p className="text-sm text-slate-500">Identity settings unavailable.</p>;
  }

  const bannerStyle = resolveImageUrl(ctx.profile.bannerUrl)
    ? { backgroundImage: `url(${resolveImageUrl(ctx.profile.bannerUrl)})` }
    : undefined;

  return (
    <div className="ula-identity-root ula-dept-animate-in space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f4c81]">Identity & settings</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          {identityPanelTitle(user?.role, scopes)}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-slate-500">
          {personalOnly
            ? 'Your photo and bio appear on your workspace, resource cards, and anywhere your name is shown.'
            : 'Manage your personal profile and the organisational identity you are authorised to govern.'}
        </p>
      </header>

      {msg ? (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            msg.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <span>{msg.text}</span>
          {msg.type === 'err' ? (
            <button
              type="button"
              className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50"
              onClick={() => {
                setLoading(true);
                void load()
                  .catch(() => setMsg({ type: 'err', text: 'Still unable to reach settings. Check that the API is running.' }))
                  .finally(() => setLoading(false));
              }}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {showPersonalHero ? (
        <div className="ula-identity-hero">
          <div className="ula-identity-hero-banner" style={bannerStyle} />
          <div className="relative px-6 pb-6 pt-0">
            <div className="-mt-8 flex items-end gap-4">
              <IdentityAvatar name={ctx.profile.fullName} imageUrl={ctx.profile.profilePhotoUrl} size="lg" />
              <div className="min-w-0 pb-1">
                <p className="font-semibold text-slate-900">{ctx.profile.fullName}</p>
                <p className="text-sm text-slate-500">{ctx.profile.email}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {visibleTabs.length > 1 ? (
      <div className="flex flex-wrap gap-2">
        {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className="ula-identity-tab"
              data-active={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
      </div>
      ) : null}

      {tab === 'profile' && scopes.profile ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <IdentityImageUpload
            label="Profile photo"
            hint="Shown on resource cards and your workspace."
            scope="profile"
            kind="photo"
            currentUrl={ctx.profile.profilePhotoUrl}
            onUpdated={handleImageUpload}
          />
          <IdentityImageUpload
            label="Profile banner"
            hint="Optional header accent on your profile."
            scope="profile"
            kind="banner"
            aspect="banner"
            currentUrl={ctx.profile.bannerUrl}
            onUpdated={handleImageUpload}
          />
          <div className="ula-identity-card space-y-4 p-5 lg:col-span-2">
            <p className="text-sm font-semibold text-slate-900">Profile details</p>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Display name</label>
              <input className={fieldCls} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Bio</label>
              <textarea
                className={`${fieldCls} min-h-[88px]`}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Short professional bio (optional)"
              />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveProfile()}
              className="rounded-xl bg-[#0f4c81] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save profile
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'department' && scopes.department && ctx.department ? (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <IdentityImageUpload
              label="Department logo"
              hint={ctx.department.name}
              scope="department"
              kind="logo"
              currentUrl={ctx.department.logoUrl}
              onUpdated={handleImageUpload}
            />
            <IdentityImageUpload
              label="Department banner"
              hint="Department workspace header."
              scope="department"
              kind="banner"
              aspect="wide"
              currentUrl={ctx.department.bannerUrl}
              onUpdated={handleImageUpload}
            />
          </div>
          {ctx.department.canEdit ? (
            <div className="ula-identity-card space-y-3 p-5">
              <label className="text-xs font-semibold text-slate-500">Department tagline</label>
              <input className={fieldCls} value={deptTagline} onChange={(e) => setDeptTagline(e.target.value)} />
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDept()}
                className="rounded-xl bg-[#0f4c81] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Save department
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'faculty' && scopes.faculty && ctx.faculty ? (
        <div className="space-y-5">
          <div className="ula-identity-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live preview</p>
            <p className="mt-1 text-sm text-slate-600">
              Faculty logo appears in your workspace sidebar under the institution mark.
            </p>
            <div className="mt-4 space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
              <InstitutionBrand variant="sidebar" subtitle="Faculty Admin" accentClass="text-[#0f4c81]" />
              <div className="flex items-center gap-2.5 border-t border-slate-100 pt-3">
                <BrandingImage
                  url={ctx.faculty.logoUrl}
                  cacheKey={ctx.faculty.logoUrl ?? 'none'}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 ring-1 ring-slate-200/80"
                  fallback={
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200/80">
                      {ctx.faculty.name.charAt(0)}
                    </span>
                  }
                />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Faculty</p>
                  <p className="text-sm font-semibold text-slate-800">{ctx.faculty.name}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <IdentityImageUpload
              label="Faculty logo"
              hint={ctx.faculty.name}
              scope="faculty"
              kind="logo"
              entityId={facultyIdOverride || ctx.faculty.id}
              syncScope={!facultyIdOverride}
              currentUrl={ctx.faculty.logoUrl}
              onUpdated={handleImageUpload}
            />
            <IdentityImageUpload
              label="Faculty banner"
              hint="Faculty command workspace."
              scope="faculty"
              kind="banner"
              aspect="wide"
              entityId={facultyIdOverride || ctx.faculty.id}
              syncScope={!facultyIdOverride}
              currentUrl={ctx.faculty.bannerUrl}
              onUpdated={handleImageUpload}
            />
          </div>
          {ctx.faculty.canEdit ? (
            <div className="ula-identity-card space-y-3 p-5">
              <label className="text-xs font-semibold text-slate-500">Faculty tagline (text only)</label>
              <input className={fieldCls} value={facTagline} onChange={(e) => setFacTagline(e.target.value)} />
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveFac()}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700"
              >
                Save tagline
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'institution' && scopes.institution && ctx.institution ? (
        <div className="space-y-5">
          <div className="ula-identity-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live preview</p>
            <p className="mt-1 text-sm text-slate-600">
              Upload the <strong>institution logo</strong> here — it replaces the platform mark on browse, login, and every workspace. Faculty logos are managed separately by faculty admins.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
              <InstitutionBrand
                variant="shell"
                accentClass="text-[#0f4c81]"
                placementOverride={instPlacement}
                shortNameOverride={instShort}
                taglineOverride={instTagline}
                logoUrlOverride={ctx.institution.logoUrl}
              />
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <IdentityImageUpload
              label="Institution logo"
              hint="Applied platform-wide — public browse, auth pages, and all workspaces."
              scope="institution"
              kind="logo"
              currentUrl={ctx.institution.logoUrl}
              onUpdated={handleImageUpload}
            />
            <IdentityImageUpload
              label="Institution banner"
              hint="Optional institutional banner."
              scope="institution"
              kind="banner"
              aspect="wide"
              currentUrl={ctx.institution.bannerUrl}
              onUpdated={handleImageUpload}
            />
          </div>
          {ctx.institution.canEdit ? (
            <div className="ula-identity-card space-y-3 p-5">
              <input className={fieldCls} value={instName} onChange={(e) => setInstName(e.target.value)} placeholder="Institution name" />
              <input className={fieldCls} value={instShort} onChange={(e) => setInstShort(e.target.value)} placeholder="Short name" />
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
                      <span className={`ula-inst-placement-option__preview`} data-side={side}>
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
                onClick={() => void saveInst()}
                className="rounded-xl bg-[#0f4c81] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Save institution details
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="ula-identity-card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-semibold text-slate-900">Session</p>
          <p className="text-xs text-slate-500">Signed in as {user?.email}</p>
        </div>
        <button
          type="button"
          onClick={() => performSignOut(logout, navigate, user)}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
