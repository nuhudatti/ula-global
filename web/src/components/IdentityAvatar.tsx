import { useEffect, useState } from 'react';
import { resolveImageUrl, withCacheBust } from '../lib/mediaUrl';

type Props = {
  name: string;
  imageUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  interactive?: boolean;
  title?: string;
  /** Load immediately for header / dashboard avatars */
  priority?: boolean;
};

const sizes = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-lg',
};

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name?.trim().charAt(0)?.toUpperCase() || '?';
}

export function IdentityAvatar({
  name,
  imageUrl,
  size = 'md',
  className = '',
  interactive = false,
  title,
  priority = false,
}: Props) {
  const resolved = withCacheBust(imageUrl, imageUrl ?? '') || resolveImageUrl(imageUrl);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [imageUrl]);

  const cls = sizes[size];
  const initial = initialsFrom(name);
  const showPhoto = Boolean(resolved) && !failed;

  const baseRing = 'ring-1 ring-slate-200/90';
  const hoverCls = interactive ? 'transition-transform duration-200 hover:scale-[1.04]' : '';

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary-50 via-slate-50 to-primary-100/80 font-semibold tracking-tight text-primary-800 ${cls} ${baseRing} ${hoverCls} ${className}`}
      title={title || name}
    >
      <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
        {initial}
      </span>
      {showPhoto ? (
        <img
          src={resolved!}
          alt=""
          className={`absolute inset-0 h-full w-full rounded-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
      ) : null}
    </span>
  );
}
