import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';

export type TenantPublic = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  tagline: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  logoPlacement: string;
  primaryColor?: string;
  secondaryColor?: string;
  status?: string;
};

type TenantContextValue = {
  slug: string;
  tenant: TenantPublic | null;
  loading: boolean;
};

const TenantContext = createContext<TenantContextValue>({ slug: '', tenant: null, loading: true });

export function TenantProvider({ children, slug: slugProp }: { children: ReactNode; slug?: string }) {
  const params = useParams();
  const slug = slugProp || params.tenantSlug || '';
  const [tenant, setTenant] = useState<TenantPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<TenantPublic>(`/api/meta/tenant/${slug}`)
      .then((t) => {
        if (!cancelled) setTenant(t);
      })
      .catch(() => {
        if (!cancelled) setTenant(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const value = useMemo(() => ({ slug, tenant, loading }), [slug, tenant, loading]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  return useContext(TenantContext);
}
