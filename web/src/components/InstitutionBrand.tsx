import { Link } from 'react-router-dom';
import { useBranding } from '../context/BrandingContext';
import type { LogoPlacement } from '../lib/settings';
import { BrandingImage } from './BrandingImage';
import '../styles/institution-brand.css';

type BrandVariant = 'shell' | 'sidebar' | 'mark' | 'auth';

export function InstitutionBrand({
  variant = 'shell',
  subtitle,
  className = '',
  asLink = false,
  linkTo = '/',
  accentClass = 'text-primary-600',
  placementOverride,
  shortNameOverride,
  taglineOverride,
  logoUrlOverride,
}: {
  variant?: BrandVariant;
  subtitle?: string;
  className?: string;
  asLink?: boolean;
  linkTo?: string;
  accentClass?: string;
  placementOverride?: LogoPlacement;
  shortNameOverride?: string;
  taglineOverride?: string;
  logoUrlOverride?: string | null;
}) {
  const { institution, mediaEpoch } = useBranding();
  const placement =
    placementOverride ?? (institution?.logoPlacement === 'right' ? 'right' : 'left');
  const shortName = shortNameOverride?.trim() || institution?.shortName?.trim() || 'ULA';
  const tagline = taglineOverride?.trim() || institution?.tagline?.trim() || 'Academic workspace';
  const rawLogo = logoUrlOverride !== undefined ? logoUrlOverride : institution?.logoUrl;
  const logoAlt = institution?.name || 'Institution logo';
  const logoSize = variant === 'mark' ? 28 : 36;
  const cacheKey = `${mediaEpoch}-${institution?.updatedAt ?? ''}-${rawLogo ?? 'none'}`;

  const content = (
    <div
      className={`ula-inst-brand ula-inst-brand--${variant} ula-inst-brand--${placement} ${className}`.trim()}
      data-placement={placement}
    >
      <BrandingImage
        url={rawLogo}
        cacheKey={cacheKey}
        alt={logoAlt}
        width={logoSize}
        height={logoSize}
        className="ula-inst-brand__logo"
        fallback={
          <span
            className="ula-inst-brand__logo inline-flex items-center justify-center bg-[#0f4c81] text-[10px] font-bold text-white"
            style={{ width: logoSize, height: logoSize }}
            aria-hidden
          >
            {shortName.slice(0, 2).toUpperCase()}
          </span>
        }
      />
      {variant !== 'mark' ? (
        <div className="ula-inst-brand__text">
          <p className="ula-inst-brand__title">
            {shortName}
            <span className={accentClass}>ULA</span>
          </p>
          {subtitle ? (
            <p className="ula-inst-brand__subtitle">{subtitle}</p>
          ) : variant === 'shell' || variant === 'auth' ? (
            <p className="ula-inst-brand__subtitle">{tagline}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (asLink) {
    return (
      <Link to={linkTo} className="ula-inst-brand-link ula-focus-ring rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
}

/** Compact institutional mark for workspace top bars */
export function InstitutionHeaderMark({ className = '' }: { className?: string }) {
  const { institution, mediaEpoch } = useBranding();
  const shortName = institution?.shortName?.trim() || 'ULA';
  const cacheKey = `${mediaEpoch}-${institution?.updatedAt ?? ''}-${institution?.logoUrl ?? ''}`;

  return (
    <div className={`ula-inst-header-mark ${className}`.trim()} title={institution?.name || 'Institution'}>
      <BrandingImage
        url={institution?.logoUrl}
        cacheKey={cacheKey}
        alt=""
        width={28}
        height={28}
        className="ula-inst-header-mark__logo"
        fallback={
          <span
            className="ula-inst-header-mark__logo inline-flex items-center justify-center bg-[#0f4c81] text-[9px] font-bold text-white"
            style={{ width: 28, height: 28 }}
            aria-hidden
          >
            {shortName.slice(0, 2).toUpperCase()}
          </span>
        }
      />
      <span className="ula-inst-header-mark__label hidden sm:inline">{shortName} ULA</span>
    </div>
  );
}
