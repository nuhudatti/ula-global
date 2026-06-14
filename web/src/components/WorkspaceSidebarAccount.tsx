import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { performSignOut } from '../lib/signOut';
import { IdentityAvatar } from './IdentityAvatar';

/** Enterprise sidebar account block with sign out. */
export function WorkspaceSidebarAccount({ roleLabel }: { roleLabel: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function signOut() {
    performSignOut(logout, navigate, user);
  }

  return (
    <div className="border-t border-slate-100 p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <IdentityAvatar name={user?.fullName ?? 'User'} imageUrl={user?.profilePhotoUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-800">{user?.fullName}</p>
          <p className="truncate text-[11px] text-slate-400">{roleLabel}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={signOut}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
      >
        <i className="fa-solid fa-right-from-bracket text-[11px] text-slate-500" aria-hidden />
        Sign out
      </button>
    </div>
  );
}
