import { useEffect, useState } from 'react';
import { fetchDeliveryUrl } from '../lib/secureFile';

/** Fetch a short-lived signed URL for iframe/img preview (public for catalogue materials). */
export function useSecurePreviewUrl(kind: string, id: string, enabled: boolean) {
  const [url, setUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !id) {
      setUrl(undefined);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDeliveryUrl(kind, id)
      .then((signed) => {
        if (!cancelled) setUrl(signed);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setUrl(undefined);
          setError(e.message || 'Preview unavailable');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kind, id, enabled]);

  return { url, loading, error };
}
