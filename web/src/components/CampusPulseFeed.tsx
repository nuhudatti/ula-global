import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useInstitutionSlug } from '../hooks/useInstitutionSlug';
import { useTenantPaths } from '../hooks/useTenantPaths';
import type { CampusPulse, CampusPulseItem } from '../lib/campusPulse';
import '../styles/campus-pulse.css';

function itemIcon(type: CampusPulseItem['type']) {
  if (type === 'trending') return 'fa-fire';
  if (type === 'discussion') return 'fa-comments';
  if (type === 'contribution') return 'fa-lightbulb';
  return 'fa-file-arrow-up';
}

export function CampusPulseFeed({
  variant = 'compact',
  showCta = false,
  maxItems = 6,
}: {
  variant?: 'compact' | 'hero';
  showCta?: boolean;
  maxItems?: number;
}) {
  const institutionSlug = useInstitutionSlug();
  const paths = useTenantPaths();
  const [data, setData] = useState<CampusPulse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pulse = await api<CampusPulse>('/api/meta/campus-pulse');
      setData(pulse);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [institutionSlug]);

  useEffect(() => {
    setData(null);
  }, [institutionSlug]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(id);
  }, [load]);

  const items = data?.items.slice(0, maxItems) ?? [];
  const stats = data?.stats;

  return (
    <div className={`ula-campus-pulse ula-campus-pulse--${variant}`}>
      <div className="ula-campus-pulse__head">
        <div>
          <span className="ula-campus-pulse__live">
            <span className="ula-campus-pulse__live-dot" aria-hidden />
            Live campus
          </span>
          <p className="ula-campus-pulse__title mt-1">
            {variant === 'hero' ? 'Your university, in motion' : 'Campus pulse'}
          </p>
        </div>
        {stats ? (
          <div className="ula-campus-pulse__stats">
            <span className="ula-campus-pulse__stat">{stats.onlineNow} online</span>
            <span className="ula-campus-pulse__stat">{stats.uploadsToday} uploads today</span>
            <span className="ula-campus-pulse__stat">{stats.discussionsToday} discussions</span>
          </div>
        ) : null}
      </div>

      <div className="ula-campus-pulse__stream" aria-live="polite" aria-busy={loading}>
        {loading && items.length === 0 ? (
          <p className="text-sm opacity-70">Connecting to campus activity…</p>
        ) : items.length === 0 ? (
          <p className="text-sm opacity-70">Be the first to shape today&apos;s archive.</p>
        ) : (
          items.map((item, i) => (
            <div
              key={item.id}
              className="ula-campus-pulse__item"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="ula-campus-pulse__avatar" aria-hidden>
                <i className={`fa-solid ${itemIcon(item.type)} text-[10px]`} />
              </span>
              <div className="ula-campus-pulse__body">
                <p className="ula-campus-pulse__msg">{item.message}</p>
                <p className="ula-campus-pulse__meta">
                  {item.department ? `${item.department} · ` : ''}
                  {item.rel}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {showCta ? (
        <div className="ula-campus-pulse__cta">
          <p className="ula-campus-pulse__cta-text">Join to contribute, discuss, and download officially verified materials.</p>
          <Link
            to={paths.login}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-[#0f4c81] shadow-sm hover:bg-slate-50"
          >
            Sign in
            <i className="fa-solid fa-arrow-right text-[10px]" aria-hidden />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
