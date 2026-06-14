import { tenantPathsFor } from './tenant';

export type FarewellPayload = {
  firstName: string;
  at: number;
};

const KEY = 'ula-farewell';
const INSTITUTION_SLUG_KEY = 'ula-last-institution-slug';

export function storeLastInstitutionSlug(slug?: string | null) {
  if (!slug) return;
  try {
    sessionStorage.setItem(INSTITUTION_SLUG_KEY, slug);
  } catch {
    /* ignore */
  }
}

export function readLastInstitutionSlug(): string | null {
  try {
    return sessionStorage.getItem(INSTITUTION_SLUG_KEY);
  } catch {
    return null;
  }
}

export function clearLastInstitutionSlug() {
  try {
    sessionStorage.removeItem(INSTITUTION_SLUG_KEY);
  } catch {
    /* ignore */
  }
}

export function storeFarewell(fullName?: string | null) {
  const firstName = fullName?.trim().split(/\s+/)[0] || 'friend';
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ firstName, at: Date.now() } satisfies FarewellPayload));
  } catch {
    /* ignore */
  }
}

export function readFarewell(maxAgeMs = 10 * 60 * 1000): FarewellPayload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as FarewellPayload;
    if (Date.now() - data.at > maxAgeMs) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearFarewell() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function signOutDestination(pathname: string, institutionSlug?: string | null): string {
  const slug = institutionSlug || readLastInstitutionSlug();
  const paths = tenantPathsFor(pathname, slug);
  if (paths.login.startsWith('/?')) return '/?signedOut=1';
  return `${paths.login}?signedOut=1`;
}

export function performSignOut(
  logout: () => void,
  navigate: (path: string, options?: { replace?: boolean }) => void,
  user?: { fullName?: string | null; institution?: { slug?: string | null } | null } | null,
  destination?: string,
) {
  const institutionSlug = user?.institution?.slug ?? readLastInstitutionSlug();
  storeFarewell(user?.fullName);
  storeLastInstitutionSlug(institutionSlug);
  const target =
    destination ??
    (typeof window !== 'undefined'
      ? signOutDestination(window.location.pathname, institutionSlug)
      : institutionSlug
        ? `/${institutionSlug}/login?signedOut=1`
        : '/?signedOut=1');
  logout();
  navigate(target, { replace: true });
}
