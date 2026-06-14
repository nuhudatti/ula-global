import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';

import { buildApiHeaders, getToken } from '../../lib/api';

import { resolveImageUrl, withCacheBust } from '../../lib/mediaUrl';

import type { IdentityUploadResult } from '../../lib/brandingUpload';

import { brandingMessage, syncBrandingAfterUpload } from '../../lib/brandingSync';

import { useBranding } from '../../context/BrandingContext';

import { useAuth } from '../../context/AuthContext';

import type { IdentityScope, ImageKind } from '../../lib/settings';



const ACCEPT = 'image/png,image/jpeg,image/webp,image/jpg';



function isImageFile(file: File): boolean {

  const mime = (file.type || '').toLowerCase();

  if (/^image\/(png|jpeg|jpg|webp)$/i.test(mime)) return true;

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  return ['png', 'jpg', 'jpeg', 'webp'].includes(ext);

}



type Props = {

  label: string;

  hint: string;

  scope: IdentityScope;

  kind: ImageKind;

  currentUrl: string | null;

  aspect?: 'square' | 'wide' | 'banner';

  entityId?: string | null;

  syncScope?: boolean;

  onUpdated?: (result: IdentityUploadResult) => void;

};



export function IdentityImageUpload({

  label,

  hint,

  scope,

  kind,

  currentUrl,

  aspect = 'square',

  entityId,

  syncScope = true,

  onUpdated,

}: Props) {

  const { applyUploadBranding, refreshInstitution, refreshScope } = useBranding();

  const { patchUser } = useAuth();

  const inputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);

  const [progress, setProgress] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState<string | null>(null);

  const [flash, setFlash] = useState(false);

  const [localUrl, setLocalUrl] = useState<string | null>(null);

  const [cacheKey, setCacheKey] = useState(0);

  const [busy, setBusy] = useState(false);



  const effectiveUrl = localUrl ?? currentUrl;

  const preview =

    withCacheBust(effectiveUrl, cacheKey) || resolveImageUrl(effectiveUrl) || null;



  useEffect(() => {

    if (localUrl && currentUrl && currentUrl === localUrl) {

      setLocalUrl(null);

    }

  }, [currentUrl, localUrl]);



  useEffect(() => {

    if (currentUrl) setCacheKey((n) => n + 1);

  }, [currentUrl]);



  const aspectCls =

    aspect === 'wide' ? 'aspect-[3/1] max-h-28' : aspect === 'banner' ? 'aspect-[4/1] max-h-32' : 'aspect-square max-h-36 max-w-[9rem]';



  const applyResult = useCallback(

    async (data: IdentityUploadResult) => {

      await syncBrandingAfterUpload(

        data,

        { applyUploadBranding, refreshInstitution, refreshScope },

        { syncScope }

      );



      if (data.scope === 'profile') {

        patchUser({

          profilePhotoUrl: data.profile?.profilePhotoUrl ?? (data.kind === 'photo' ? data.url : undefined),

          bannerUrl: data.profile?.bannerUrl ?? (data.kind === 'banner' ? data.url : undefined),

        });

      }



      onUpdated?.(data);

    },

    [applyUploadBranding, refreshInstitution, refreshScope, syncScope, patchUser, onUpdated]

  );



  const upload = useCallback(

    async (file: File) => {

      setError(null);

      setSuccess(null);

      if (!isImageFile(file)) {

        setError('Use PNG, JPG, or WEBP only.');

        return;

      }

      if (file.size > 5 * 1024 * 1024) {

        setError('Maximum size is 5 MB.');

        return;

      }



      const objectUrl = URL.createObjectURL(file);

      setLocalUrl(objectUrl);

      setBusy(true);

      setProgress(15);



      try {

        const fd = new FormData();

        fd.append('file', file);

        fd.append('scope', scope);

        fd.append('kind', kind);

        if (entityId && scope === 'faculty') fd.append('facultyId', entityId);



        const token = getToken();

        if (!token) throw new Error('You are signed out. Please sign in again.');



        setProgress(45);

        const res = await fetch('/api/settings/images', {

          method: 'POST',

          headers: buildApiHeaders(),

          body: fd,

        });

        const body = (await res.json()) as IdentityUploadResult & { error?: string };

        if (!res.ok) {

          throw new Error(body.error || `Upload failed (${res.status})`);

        }



        setProgress(100);

        setLocalUrl(body.url);

        setCacheKey((n) => n + 1);

        await applyResult(body);

        setSuccess(brandingMessage(body));

        setFlash(true);

        setTimeout(() => setFlash(false), 900);

      } catch (e) {

        setError(e instanceof Error ? e.message : 'Upload failed');

        setLocalUrl(null);

      } finally {

        setBusy(false);

        setTimeout(() => setProgress(null), 600);

        URL.revokeObjectURL(objectUrl);

      }

    },

    [scope, kind, entityId, applyResult]

  );



  async function remove() {

    setBusy(true);

    setError(null);

    setSuccess(null);

    try {

      const token = getToken();

      if (!token) throw new Error('You are signed out. Please sign in again.');

      const qs = new URLSearchParams({ scope, kind });

      if (entityId && scope === 'faculty') qs.set('facultyId', entityId);

      const res = await fetch(`/api/settings/images?${qs.toString()}`, {

        method: 'DELETE',

        headers: buildApiHeaders(),

      });

      const body = (await res.json()) as IdentityUploadResult & { error?: string };

      if (!res.ok) throw new Error(body.error || 'Remove failed');

      setLocalUrl(null);

      await applyResult({ ...body, url: null });

      setSuccess('Image removed.');

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Remove failed');

    } finally {

      setBusy(false);

    }

  }



  function onDrop(e: DragEvent) {

    e.preventDefault();

    setDragOver(false);

    const f = e.dataTransfer.files?.[0];

    if (f) void upload(f);

  }



  return (

    <div className={`ula-identity-card p-5 ${flash ? 'ula-identity-success' : ''}`}>

      <p className="text-sm font-semibold text-slate-900">{label}</p>

      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>

      <p className="mt-1 text-[11px] font-medium text-[#0f4c81]">

        Saves instantly on upload — no Save button needed.

      </p>



      {preview ? (

        <div className={`ula-identity-preview mt-4 ${aspectCls} mx-auto w-full`}>

          <img src={preview} alt="" className="h-full w-full object-cover" />

        </div>

      ) : null}



      <div

        className="ula-identity-drop mt-4"

        data-active={dragOver}

        onDragOver={(e) => {

          e.preventDefault();

          setDragOver(true);

        }}

        onDragLeave={() => setDragOver(false)}

        onDrop={onDrop}

        onClick={() => inputRef.current?.click()}

        role="button"

        tabIndex={0}

        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}

      >

        <i className="fa-solid fa-cloud-arrow-up mb-2 text-xl text-[#0f4c81]" aria-hidden />

        <p className="text-sm font-medium text-slate-800">Drag & drop or click to upload</p>

        <p className="mt-1 text-xs text-slate-500">PNG, JPG, WEBP · max 5 MB</p>

        <input

          ref={inputRef}

          type="file"

          accept={ACCEPT}

          className="sr-only"

          disabled={busy}

          onChange={(e) => {

            const f = e.target.files?.[0];

            if (f) void upload(f);

            e.target.value = '';

          }}

        />

      </div>



      {progress !== null ? (

        <div className="mt-3">

          <div className="h-1 overflow-hidden rounded-full bg-slate-100">

            <div className="h-full bg-[#0f4c81] transition-all" style={{ width: `${progress}%` }} />

          </div>

        </div>

      ) : null}



      {success ? (

        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">

          <i className="fa-solid fa-circle-check mr-1.5" aria-hidden />

          {success}

        </p>

      ) : null}



      {error ? (

        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">

          <i className="fa-solid fa-circle-exclamation mr-1.5" aria-hidden />

          {error}

        </p>

      ) : null}



      {preview ? (

        <div className="mt-3 flex flex-wrap gap-2">

          <button

            type="button"

            disabled={busy}

            onClick={() => inputRef.current?.click()}

            className="text-xs font-semibold text-[#0f4c81] hover:underline"

          >

            Replace

          </button>

          <button

            type="button"

            disabled={busy}

            onClick={() => void remove()}

            className="text-xs font-semibold text-slate-500 hover:text-red-700"

          >

            Remove

          </button>

        </div>

      ) : null}

    </div>

  );

}


