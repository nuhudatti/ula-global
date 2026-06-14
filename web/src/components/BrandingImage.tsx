import { useEffect, useState, type ReactNode } from 'react';
import { resolveImageUrl, withCacheBust } from '../lib/mediaUrl';

type Props = {
  url: string | null | undefined;
  cacheKey?: string | number;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
  fallback?: ReactNode;
  rounded?: boolean;
};

export function BrandingImage({
  url,
  cacheKey = 0,
  alt = '',
  className = '',
  width,
  height,
  fallback = null,
  rounded = true,
}: Props) {
  const [failed, setFailed] = useState(false);
  const resolved = withCacheBust(url, cacheKey) || resolveImageUrl(url);

  useEffect(() => {
    setFailed(false);
  }, [url, cacheKey]);

  if (!resolved || failed) {
    return <>{fallback}</>;
  }

  return (
    <img
      key={`${resolved}-${cacheKey}`}
      src={resolved}
      alt={alt}
      width={width}
      height={height}
      className={`${rounded ? 'rounded-full object-cover' : 'object-cover'} ${className}`.trim()}
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
