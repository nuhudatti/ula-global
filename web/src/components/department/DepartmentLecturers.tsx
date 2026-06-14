import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { DeptInvitation, DeptLecturer, InvitationStatus } from '../../lib/department';
import { INVITATION_STATUS_LABELS, STATUS_LABELS } from '../../lib/department';
import { AddLecturerWizard } from './AddLecturerWizard';
import { IdentityAvatar } from '../IdentityAvatar';

type InviteLinkResponse = {
  inviteUrl: string;
  activationUrl?: string;
  devActivationUrl?: string;
  emailSent?: boolean;
  emailError?: string | null;
};

function resolveInviteUrl(res: InviteLinkResponse) {
  return res.devActivationUrl || res.activationUrl || `${window.location.origin}${res.inviteUrl}`;
}

function invitationBadgeClass(status: InvitationStatus) {
  if (status === 'PENDING') return 'bg-amber-50 text-amber-800 ring-amber-200';
  if (status === 'ACCEPTED') return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  if (status === 'CANCELLED') return 'bg-slate-100 text-slate-600 ring-slate-200';
  return 'bg-red-50 text-red-800 ring-red-200';
}

export function DepartmentLecturers({
  lecturers,
  invitations,
  loading,
  searchQuery = '',
  onSearchChange,
  openWizard = false,
  onWizardOpenChange,
  onRefresh,
}: {
  lecturers: DeptLecturer[];
  invitations: DeptInvitation[];
  loading: boolean;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  openWizard?: boolean;
  onWizardOpenChange?: (open: boolean) => void;
  onRefresh: () => void;
}) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [showWizard, setShowWizard] = useState(openWizard);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    setShowWizard(openWizard);
  }, [openWizard]);

  function updateSearch(value: string) {
    setLocalSearch(value);
    onSearchChange?.(value);
  }

  function setWizardOpen(open: boolean) {
    setShowWizard(open);
    onWizardOpenChange?.(open);
  }

  const filteredLecturers = useMemo(() => {
    const q = localSearch.trim().toLowerCase();
    if (!q) return lecturers;
    return lecturers.filter(
      (l) =>
        l.fullName.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.staffId && l.staffId.toLowerCase().includes(q)),
    );
  }, [lecturers, localSearch]);

  const filteredInvitations = useMemo(() => {
    const q = localSearch.trim().toLowerCase();
    if (!q) return invitations;
    return invitations.filter(
      (inv) =>
        inv.fullName.toLowerCase().includes(q) ||
        inv.email.toLowerCase().includes(q) ||
        (inv.staffId && inv.staffId.toLowerCase().includes(q)),
    );
  }, [invitations, localSearch]);

  const detailsInvite = filteredInvitations.find((inv) => inv.id === detailsId) ?? null;

  async function setStatus(id: string, accountStatus: string) {
    setBusyId(id);
    try {
      await api(`/api/department/lecturers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ accountStatus }),
      });
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function copyInviteLink(inviteId: string) {
    setBusyId(inviteId);
    try {
      const res = await api<InviteLinkResponse>(`/api/department/invites/${inviteId}/link`);
      const url = resolveInviteUrl(res);
      await navigator.clipboard.writeText(url);
      alert('Invitation link copied to clipboard.');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not copy invitation link');
    } finally {
      setBusyId(null);
    }
  }

  async function resendInvitation(inviteId: string) {
    setBusyId(inviteId);
    try {
      const res = await api<InviteLinkResponse>(`/api/department/invites/${inviteId}/resend`, {
        method: 'POST',
      });
      const url = resolveInviteUrl(res);
      await navigator.clipboard.writeText(url);
      alert(
        res.emailSent
          ? 'Invitation resent by email. Link also copied to clipboard.'
          : `Email may not have arrived — link copied.${res.emailError ? ` (${res.emailError})` : ''}`,
      );
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Resend failed');
    } finally {
      setBusyId(null);
    }
  }

  async function cancelInvitation(inviteId: string) {
    if (!confirm('Cancel this invitation? The lecturer will need a new invite to join.')) return;
    setBusyId(inviteId);
    try {
      await api(`/api/department/invites/${inviteId}`, { method: 'DELETE' });
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  }

  if (showWizard) {
    return (
      <AddLecturerWizard
        onClose={() => setWizardOpen(false)}
        onSuccess={() => {
          setWizardOpen(false);
          onRefresh();
        }}
      />
    );
  }

  const hasResults = filteredLecturers.length > 0 || filteredInvitations.length > 0;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">People & invitations</h2>
          <p className="text-sm text-slate-500">
            Active lecturers publish materials. Pending invitations become active after the lecturer accepts the secure
            link and sets a password.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0f4c81] px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
        >
          <i className="fa-solid fa-user-plus text-xs" aria-hidden />
          Invite lecturer
        </button>
      </div>

      <div className="relative max-w-md">
        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
        <input
          className="ula-dept-search w-full"
          placeholder="Search lecturers and invitations…"
          value={localSearch}
          onChange={(e) => updateSearch(e.target.value)}
        />
      </div>

      {filteredInvitations.length > 0 ? (
        <div className="ula-dept-surface overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invitation tracking</p>
          </div>
          <div className="hidden border-b border-slate-100 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:grid md:grid-cols-[1.3fr_0.7fr_0.8fr_auto] md:gap-4">
            <span>Invitee</span>
            <span>Status</span>
            <span>Dates</span>
            <span>Actions</span>
          </div>
          {filteredInvitations.map((inv) => (
            <div key={inv.id} className="border-b border-slate-100 px-5 py-4 last:border-0">
              <div className="md:grid md:grid-cols-[1.3fr_0.7fr_0.8fr_auto] md:items-center md:gap-4">
                <div>
                  <p className="font-semibold text-slate-900">{inv.fullName}</p>
                  <p className="text-xs text-slate-500">{inv.email}</p>
                </div>
                <div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${invitationBadgeClass(inv.status)}`}
                  >
                    {INVITATION_STATUS_LABELS[inv.status]}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500 md:mt-0">
                  <p>Sent {new Date(inv.createdAt).toLocaleDateString()}</p>
                  <p>Expires {new Date(inv.expiresAt).toLocaleDateString()}</p>
                  {inv.acceptedAt ? <p>Accepted {new Date(inv.acceptedAt).toLocaleDateString()}</p> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 md:mt-0">
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                    onClick={() => setDetailsId(detailsId === inv.id ? null : inv.id)}
                  >
                    Details
                  </button>
                  {inv.status === 'PENDING' ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId === inv.id}
                        onClick={() => void copyInviteLink(inv.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                      >
                        Copy link
                      </button>
                      <button
                        type="button"
                        disabled={busyId === inv.id}
                        onClick={() => void resendInvitation(inv.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0f4c81] ring-1 ring-[#0f4c81]/20"
                      >
                        Resend
                      </button>
                      <button
                        type="button"
                        disabled={busyId === inv.id}
                        onClick={() => void cancelInvitation(inv.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200"
                      >
                        Cancel
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              {detailsId === inv.id ? (
                <div className="mt-3 rounded-xl bg-slate-50 p-4 text-xs text-slate-600 ring-1 ring-slate-100">
                  <p>
                    <strong>Role:</strong> {inv.departmentRole}
                  </p>
                  <p>
                    <strong>Invited by:</strong> {inv.invitedBy || '—'}
                  </p>
                  <p>
                    <strong>Department:</strong> {inv.departmentName || '—'}
                  </p>
                  {inv.status === 'PENDING' ? (
                    <p className="mt-2 break-all">
                      <strong>Link:</strong> {`${window.location.origin}${inv.inviteUrl}`}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="ula-dept-surface overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active lecturers</p>
        </div>
        <div className="hidden border-b border-slate-100 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:grid md:grid-cols-[1.4fr_0.9fr_0.8fr_auto] md:gap-4">
          <span>Lecturer</span>
          <span>Publications</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading lecturers…</div>
        ) : filteredLecturers.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <i className="fa-solid fa-users text-lg" aria-hidden />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              {localSearch.trim() ? 'No matching lecturers' : 'No active lecturers yet'}
            </h3>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              {localSearch.trim()
                ? 'Try a different name, email, or staff ID.'
                : 'Invite a lecturer with a secure link. They become active after accepting the invitation.'}
            </p>
            {!localSearch.trim() && !hasResults ? (
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="mt-6 rounded-xl bg-[#0f4c81] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Invite first lecturer
              </button>
            ) : null}
          </div>
        ) : (
          filteredLecturers.map((l) => (
            <div key={l.id} className="ula-dept-lecturer-row">
              <div className="flex items-center gap-3">
                <IdentityAvatar name={l.fullName} imageUrl={l.profilePhotoUrl} size="md" className="!h-11 !w-11" />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{l.fullName}</p>
                  <p className="truncate text-xs text-slate-500">{l.email}</p>
                  {l.staffId ? <p className="text-[10px] text-slate-400">{l.staffId}</p> : null}
                </div>
              </div>
              <div className="text-sm text-slate-600">
                <p className="text-lg font-semibold tabular-nums text-slate-900">{l._count.uploads}</p>
                <p className="text-xs text-slate-400">
                  {l._count.uploads === 1 ? 'publication' : 'publications'}
                </p>
              </div>
              <div>
                <span className="ula-dept-badge" data-status={l.accountStatus}>
                  {STATUS_LABELS[l.accountStatus] || l.accountStatus}
                </span>
                <p className="mt-1 text-[10px] text-slate-400">
                  {l.lastActiveAt
                    ? `Active ${new Date(l.lastActiveAt).toLocaleDateString()}`
                    : `Joined ${new Date(l.createdAt).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {l.accountStatus === 'SUSPENDED' ? (
                  <button
                    type="button"
                    disabled={busyId === l.id}
                    onClick={() => void setStatus(l.id, 'ACTIVE')}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200"
                  >
                    Activate
                  </button>
                ) : l.accountStatus === 'ACTIVE' ? (
                  <button
                    type="button"
                    disabled={busyId === l.id}
                    onClick={() => void setStatus(l.id, 'SUSPENDED')}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                  >
                    Suspend
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
