import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../lib/api';
import { useInstitutionSlug } from '../hooks/useInstitutionSlug';
import { useAuth } from './AuthContext';
import type { IdentityUploadResult } from '../lib/brandingUpload';
import type { InstitutionPublic, LogoPlacement, SettingsOrg } from '../lib/settings';

export type ScopeBranding = Pick<SettingsOrg, 'id' | 'name' | 'tagline' | 'logoUrl' | 'bannerUrl'> & {
  code?: string;
  facultyName?: string;
};

type BrandingContextValue = {
  institution: InstitutionPublic | null;
  faculty: ScopeBranding | null;
  department: ScopeBranding | null;
  loading: boolean;
  mediaEpoch: number;
  scopeEpoch: number;
  refreshInstitution: () => Promise<void>;
  refreshScope: () => Promise<void>;
  refreshAll: () => Promise<void>;
  updateInstitution: (patch: Partial<InstitutionPublic>) => void;
  updateFaculty: (patch: Partial<ScopeBranding>) => void;
  updateDepartment: (patch: Partial<ScopeBranding>) => void;
  applyUploadBranding: (result: IdentityUploadResult, options?: { syncScope?: boolean }) => void;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

function normalizeInstitution(data: InstitutionPublic): InstitutionPublic {
  return {
    ...data,
    logoPlacement: data.logoPlacement === 'right' ? 'right' : 'left',
  };
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const slug = useInstitutionSlug();
  const { user } = useAuth();
  const [institution, setInstitution] = useState<InstitutionPublic | null>(null);
  const [faculty, setFaculty] = useState<ScopeBranding | null>(null);
  const [department, setDepartment] = useState<ScopeBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [mediaEpoch, setMediaEpoch] = useState(0);
  const [scopeEpoch, setScopeEpoch] = useState(0);

  const bumpMedia = useCallback(() => setMediaEpoch((n) => n + 1), []);
  const bumpScope = useCallback(() => setScopeEpoch((n) => n + 1), []);

  const updateInstitution = useCallback(
    (patch: Partial<InstitutionPublic>) => {
      setInstitution((prev) =>
        normalizeInstitution({
          ...(prev ?? { id: '', name: '', shortName: 'ULA', tagline: null, logoUrl: null, bannerUrl: null, logoPlacement: 'left' }),
          ...patch,
        } as InstitutionPublic)
      );
      if (patch.logoUrl !== undefined || patch.bannerUrl !== undefined) bumpMedia();
    },
    [bumpMedia]
  );

  const updateFaculty = useCallback(
    (patch: Partial<ScopeBranding>) => {
      setFaculty((prev) => ({ ...(prev ?? { id: '', name: '' }), ...patch } as ScopeBranding));
      if (patch.logoUrl !== undefined || patch.bannerUrl !== undefined) bumpScope();
    },
    [bumpScope]
  );

  const updateDepartment = useCallback(
    (patch: Partial<ScopeBranding>) => {
      setDepartment((prev) => ({ ...(prev ?? { id: '', name: '' }), ...patch } as ScopeBranding));
      if (patch.logoUrl !== undefined || patch.bannerUrl !== undefined) bumpScope();
    },
    [bumpScope]
  );

  const applyUploadBranding = useCallback(
    (result: IdentityUploadResult, options?: { syncScope?: boolean }) => {
      const syncScope = options?.syncScope !== false;
      if (result.institution) {
        setInstitution(normalizeInstitution(result.institution));
        bumpMedia();
      }
      if (syncScope && result.faculty) {
        setFaculty(result.faculty);
        bumpScope();
      }
      if (syncScope && result.department) {
        setDepartment(result.department);
        bumpScope();
      }
    },
    [bumpMedia, bumpScope]
  );

  const refreshInstitution = useCallback(async () => {
    if (!slug) {
      setInstitution(null);
      return;
    }
    try {
      const data = await api<InstitutionPublic>(`/api/meta/tenant/${slug}`);
      setInstitution(normalizeInstitution(data));
      bumpMedia();
    } catch {
      setInstitution(null);
    }
  }, [slug, bumpMedia]);

  const refreshScope = useCallback(async () => {
    if (!user) {
      setFaculty(null);
      setDepartment(null);
      return;
    }
    try {
      const data = await api<{ faculty: ScopeBranding | null; department: ScopeBranding | null }>(
        '/api/meta/scope-branding'
      );
      setFaculty(data.faculty);
      setDepartment(data.department);
      bumpScope();
    } catch {
      /* keep cached */
    }
  }, [user?.id, bumpScope]);

  const refreshAll = useCallback(async () => {
    if (!slug) {
      setInstitution(null);
      setFaculty(null);
      setDepartment(null);
      setLoading(false);
      return;
    }
    await Promise.all([refreshInstitution(), refreshScope()]);
    setLoading(false);
  }, [slug, refreshInstitution, refreshScope]);

  useEffect(() => {
    setInstitution(null);
    setFaculty(null);
    setDepartment(null);
    setLoading(Boolean(slug));
    void refreshAll();
  }, [slug, refreshAll]);

  useEffect(() => {
    void refreshScope();
  }, [user?.id, user?.role, refreshScope]);

  useEffect(() => {
    function onBrandingChanged() {
      void refreshAll();
    }
    window.addEventListener('ula-branding-changed', onBrandingChanged);
    return () => window.removeEventListener('ula-branding-changed', onBrandingChanged);
  }, [refreshAll]);

  const value = useMemo(
    () => ({
      institution,
      faculty,
      department,
      loading,
      mediaEpoch,
      scopeEpoch,
      refreshInstitution,
      refreshScope,
      refreshAll,
      updateInstitution,
      updateFaculty,
      updateDepartment,
      applyUploadBranding,
    }),
    [
      institution,
      faculty,
      department,
      loading,
      mediaEpoch,
      scopeEpoch,
      refreshInstitution,
      refreshScope,
      refreshAll,
      updateInstitution,
      updateFaculty,
      updateDepartment,
      applyUploadBranding,
    ]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

/** InstitutionProvider alias — wraps BrandingProvider */
export const InstitutionProvider = BrandingProvider;

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider');
  return ctx;
}

/** Back-compat for institution-only consumers */
export function useInstitution() {
  const ctx = useBranding();
  return {
    institution: ctx.institution,
    loading: ctx.loading,
    mediaEpoch: ctx.mediaEpoch,
    refresh: ctx.refreshInstitution,
    updateInstitution: ctx.updateInstitution,
  };
}

export function useLogoPlacement(): LogoPlacement {
  const { institution } = useBranding();
  return institution?.logoPlacement === 'right' ? 'right' : 'left';
}
