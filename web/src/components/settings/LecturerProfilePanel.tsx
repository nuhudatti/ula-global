import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { IdentityUploadResult } from '../../lib/brandingUpload';
import { IdentityImageUpload } from './IdentityImageUpload';
import { IdentityAvatar } from '../IdentityAvatar';
import '../../styles/identity-settings.css';

const fieldCls =
  'w-full rounded-xl border-0 bg-slate-50/90 py-2.5 px-3.5 text-sm text-slate-800 ring-1 ring-slate-200/90 focus:ring-2 focus:ring-[#0f4c81]/40';

/** Lecturer / Student — profile photo & bio only. */
export function LecturerProfilePanel({ onChange }: { onChange?: () => void }) {
  const { user, refresh: refreshAuth, patchUser } = useAuth();
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    const data = await api<{ profile: { fullName: string; bio: string | null; profilePhotoUrl: string | null; bannerUrl: string | null } }>(
      '/api/settings/context'
    );
    setFullName(data.profile.fullName);
    setBio(data.profile.bio ?? '');
    setPhotoUrl(data.profile.profilePhotoUrl);
    setBannerUrl(data.profile.bannerUrl);
  }, []);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setBio(user.bio ?? '');
      setPhotoUrl(user.profilePhotoUrl ?? null);
      setBannerUrl(user.bannerUrl ?? null);
    }
    void load().catch(() => undefined);
  }, [user?.id, load, user]);

  function onPhotoUploaded(result: IdentityUploadResult) {
    const photo = result.profile?.profilePhotoUrl ?? (result.kind === 'photo' ? result.url : undefined);
    const banner = result.profile?.bannerUrl ?? (result.kind === 'banner' ? result.url : undefined);
    if (photo !== undefined) {
      setPhotoUrl(photo);
      patchUser({ profilePhotoUrl: photo });
    }
    if (banner !== undefined) {
      setBannerUrl(banner);
      patchUser({ bannerUrl: banner });
    }
    void refreshAuth();
    onChange?.();
  }

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
      onChange?.();
      setMsg({ type: 'ok', text: 'Profile saved.' });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ula-identity-root ula-dept-animate-in space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f4c81]">Your profile</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Photo & details</h2>
        <p className="mt-2 text-sm text-slate-500">
          Your photo appears on resource cards, your workspace, and anywhere your name is shown.
        </p>
      </header>

      {msg ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            msg.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {msg.text}
        </div>
      ) : null}

      <div className="ula-identity-card flex items-center gap-4 p-5">
        <IdentityAvatar name={fullName || user?.fullName || 'User'} imageUrl={photoUrl} size="lg" />
        <div>
          <p className="font-semibold text-slate-900">{fullName || user?.fullName}</p>
          <p className="text-sm text-slate-500">{user?.email}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <IdentityImageUpload
          label="Profile photo"
          hint="Upload your photo — saves instantly."
          scope="profile"
          kind="photo"
          currentUrl={photoUrl}
          syncScope={false}
          onUpdated={onPhotoUploaded}
        />
        <IdentityImageUpload
          label="Profile banner"
          hint="Optional header accent."
          scope="profile"
          kind="banner"
          aspect="banner"
          currentUrl={bannerUrl}
          syncScope={false}
          onUpdated={onPhotoUploaded}
        />
      </div>

      <div className="ula-identity-card space-y-4 p-5">
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
          Save profile details
        </button>
      </div>
    </div>
  );
}
