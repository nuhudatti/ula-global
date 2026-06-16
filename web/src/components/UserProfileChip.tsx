import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { performSignOut } from '../lib/signOut';
import { IdentityAvatar } from './IdentityAvatar';

type Props = {
  name: string;
  subtitle?: string;
  imageUrl?: string | null;
  imageCacheKey?: string | number | null;
  size?: 'sm' | 'md' | 'lg';
  /** Avatar only — no name row (header corner) */
  compact?: boolean;
  onOpenProfile?: () => void;
  /** Label for branding / profile action (default: "Photo & identity") */
  profileActionLabel?: string;
  settingsHref?: string;
  /** Hide settings link — use for org admins who manage branding in-workspace */
  showSettings?: boolean;
  showLogout?: boolean;
  className?: string;
  priority?: boolean;
};

export function UserProfileChip({
  name,
  subtitle,
  imageUrl,
  imageCacheKey,
  size = 'sm',
  compact = false,
  onOpenProfile,
  profileActionLabel = 'Photo & identity',
  settingsHref = '/settings',
  showSettings = true,
  showLogout = true,
  className = '',
  priority = false,
}: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function signOut() {
    setOpen(false);
    performSignOut(logout, navigate, user ?? { fullName: name });
  }

  const avatar = (
    <IdentityAvatar
      name={name}
      imageUrl={imageUrl}
      cacheKey={imageCacheKey ?? imageUrl}
      size={size}
      interactive
      priority={priority}
      className={compact ? 'ring-2 ring-white shadow-md' : 'ring-2 ring-primary-100/80 shadow-sm'}
    />
  );

  const menuItems = (
    <>
      {onOpenProfile ? (
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-dark-700 hover:bg-dark-50"
          onClick={() => {
            setOpen(false);
            onOpenProfile();
          }}
        >
          <i className="fa-solid fa-palette w-4 text-dark-400" aria-hidden />
          {profileActionLabel}
        </button>
      ) : null}
      {showSettings ? (
        <Link
          to={settingsHref}
          role="menuitem"
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-dark-700 hover:bg-dark-50"
          onClick={() => setOpen(false)}
        >
          <i className="fa-solid fa-gear w-4 text-dark-400" aria-hidden />
          Settings
        </Link>
      ) : null}
      {showLogout ? (
        <>
          <div className="my-1 border-t border-dark-50" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50"
            onClick={signOut}
          >
            <i className="fa-solid fa-right-from-bracket w-4 text-red-500" aria-hidden />
            Sign out
          </button>
        </>
      ) : null}
    </>
  );

  if (compact) {
    return (
      <div ref={rootRef} className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
          aria-label={`${name} — account menu`}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          {avatar}
        </button>
        {open ? (
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[220px] overflow-hidden rounded-xl border border-dark-100 bg-white py-1 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.18)]"
          >
            <div className="border-b border-dark-50 px-4 py-3">
              <p className="truncate text-sm font-semibold text-dark-900">{name}</p>
              {subtitle ? <p className="truncate text-xs text-dark-500">{subtitle}</p> : null}
            </div>
            {menuItems}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`relative flex items-center gap-2.5 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="shrink-0 rounded-full transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
        aria-label={`${name} — account menu`}
        aria-expanded={open}
      >
        {avatar}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium text-dark-800">{name}</p>
        {subtitle ? <p className="truncate text-[11px] text-dark-400">{subtitle}</p> : null}
      </div>
      {open ? (
        <div className="absolute bottom-full left-3 z-50 mb-2 min-w-[220px] overflow-hidden rounded-xl border border-dark-100 bg-white py-1 shadow-lg">
          {menuItems}
        </div>
      ) : null}
    </div>
  );
}
