import { useBranding } from '../context/BrandingContext';
import { resolveImageUrl, withCacheBust } from '../lib/mediaUrl';
import '../styles/institution-brand.css';

type Props = {
  variant?: 'hero' | 'compact';
  className?: string;
  /** Local preview URL (branding panel) before context refresh */
  urlOverride?: string | null;
};

/** Institution banner on public pages (browse, sign-in, register). */
export function InstitutionPublicBanner({ variant = 'hero', className = '', urlOverride }: Props) {
  const { institution, mediaEpoch } = useBranding();
  const rawUrl = urlOverride !== undefined ? urlOverride : institution?.bannerUrl;
  const src =
    withCacheBust(rawUrl, `${mediaEpoch}-${institution?.updatedAt ?? ''}`) || resolveImageUrl(rawUrl);

  if (!src) {
    if (variant === 'compact') return null;
    return (
      <div
        className={`ula-inst-public-banner ula-inst-public-banner--fallback ${className}`.trim()}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={`ula-inst-public-banner ula-inst-public-banner--${variant} ${className}`.trim()}
      style={{ backgroundImage: `url(${src})` }}
      role="img"
      aria-label={institution?.name ? `${institution.name} banner` : 'Institution banner'}
    />
  );
}
