import { useLayoutEffect, type ReactNode } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { TenantProvider, useTenant } from '../context/TenantContext';
import { setInstitutionSlugHeader } from '../lib/api';
import { InstitutionNotFoundPage } from '../pages/InstitutionNotFoundPage';
import { RESERVED_SLUGS } from '../lib/tenant';

function TenantGate({ children }: { children: ReactNode }) {
  const { slug, tenant, loading } = useTenant();

  useLayoutEffect(() => {
    setInstitutionSlugHeader(slug);
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        Loading institution…
      </div>
    );
  }

  if (!tenant) return <InstitutionNotFoundPage slug={slug} />;
  if (tenant.status === 'SUSPENDED') {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Institution suspended</h1>
        <p className="mt-2 text-sm text-slate-500">This university workspace is temporarily unavailable.</p>
      </div>
    );
  }

  return <>{children}</>;
}

export function TenantShell() {
  const { tenantSlug } = useParams();
  if (!tenantSlug || RESERVED_SLUGS.has(tenantSlug)) return <Navigate to="/" replace />;
  return (
    <TenantProvider slug={tenantSlug}>
      <TenantGate>
        <Outlet />
      </TenantGate>
    </TenantProvider>
  );
}
