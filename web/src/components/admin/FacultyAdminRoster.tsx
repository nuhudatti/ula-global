import { useState } from 'react';
import { api } from '../../lib/api';
import type { FacultyAdmin, FacultyAdminInvite, ResendInviteResult } from '../../lib/adminFaculties';
import { IdentityAvatar } from '../IdentityAvatar';
import { AdminToast, type ToastTone } from './AdminToast';
import { InvitationLinkPanel, type InvitationLinkResult } from '../InvitationLinkPanel';

type RosterRow =
  | { kind: 'active'; admin: FacultyAdmin }
  | { kind: 'pending'; invite: FacultyAdminInvite };

function statusLabel(row: RosterRow) {
  if (row.kind === 'active') return 'Active';
  if (row.invite.lifecycleStatus === 'EXPIRED') return 'Expired';
  return 'Pending';
}

function statusClass(row: RosterRow) {
  if (row.kind === 'active') return 'ula-admin-status--active';
  if (row.invite.lifecycleStatus === 'EXPIRED') return 'ula-admin-status--expired';
  return 'ula-admin-status--pending';
}

function formatExpiry(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function FacultyAdminRoster({
  facultyId,
  admins,
  pendingInvites,
  busy,
  onBusyChange,
  onChanged,
  onError,
}: {
  facultyId: string;
  admins: FacultyAdmin[];
  pendingInvites: FacultyAdminInvite[];
  busy: boolean;
  onBusyChange: (v: boolean) => void;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [resentCredentials, setResentCredentials] = useState<InvitationLinkResult | null>(null);

  const rows: RosterRow[] = [
    ...pendingInvites.map((invite) => ({ kind: 'pending' as const, invite })),
    ...admins.map((admin) => ({ kind: 'active' as const, admin })),
  ];

  function showToast(message: string, tone: ToastTone = 'success') {
    setToast({ message, tone });
  }

  async function runAction(key: string, fn: () => Promise<void>) {
    setActionKey(key);
    onBusyChange(true);
    onError('');
    try {
      await fn();
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionKey(null);
      onBusyChange(false);
    }
  }

  async function resendInvite(inviteId: string, name: string, email: string) {
    await runAction(`resend-${inviteId}`, async () => {
      const res = await api<ResendInviteResult>(
        `/api/admin/faculties/${facultyId}/admins/invites/${inviteId}/resend`,
        { method: 'POST' }
      );
      setResentCredentials({
        fullName: name,
        email,
        inviteUrl: res.inviteUrl,
        activationUrl: res.activationUrl,
        devActivationUrl: res.devActivationUrl,
        emailSent: res.emailSent,
        emailError: res.emailError,
      });
      const url = res.devActivationUrl || res.activationUrl || (res.inviteUrl ? `${window.location.origin}${res.inviteUrl}` : '');
      if (url) await navigator.clipboard.writeText(url);
      showToast(
        res.emailSent
          ? 'Invitation resent by email. Link copied to clipboard.'
          : `Email may not have arrived — link copied.${res.emailError ? ` (${res.emailError})` : ''}`,
        res.emailSent ? 'success' : 'info',
      );
    });
  }

  async function copyLink(inviteId: string) {
    await runAction(`copy-${inviteId}`, async () => {
      const res = await api<ResendInviteResult>(
        `/api/admin/faculties/${facultyId}/admins/invites/${inviteId}/activation-link`
      );
      const url = res.devActivationUrl || res.activationUrl || (res.inviteUrl ? `${window.location.origin}${res.inviteUrl}` : '');
      if (!url) throw new Error('No invitation link available');
      await navigator.clipboard.writeText(url);
      showToast('Invitation link copied to clipboard.');
    });
  }

  async function revokeInvite(inviteId: string, name: string) {
    if (!confirm(`Cancel the invitation for ${name}? They will no longer be able to activate with this link.`)) {
      return;
    }
    await runAction(`revoke-${inviteId}`, async () => {
      await api(`/api/admin/faculties/${facultyId}/admins/invites/${inviteId}/revoke`, { method: 'POST' });
      showToast(`Invitation for ${name} cancelled.`);
    });
  }

  async function deactivateAdmin(userId: string, name: string) {
    if (!confirm(`Deactivate ${name}? They will lose access to the faculty workspace until reassigned.`)) {
      return;
    }
    await runAction(`deactivate-${userId}`, async () => {
      await api(`/api/admin/faculties/${facultyId}/admins/${userId}/deactivate`, { method: 'POST' });
      showToast(`${name} has been deactivated.`);
    });
  }

  if (rows.length === 0) {
    return (
      <div className="ula-admin-roster-empty">
        <div className="ula-admin-roster-empty__icon" aria-hidden>
          <i className="fa-solid fa-user-shield" />
        </div>
        <h4 className="ula-admin-roster-empty__title">No faculty administrators yet</h4>
        <p className="ula-admin-roster-empty__text">
          Invite someone below. They will receive a secure invitation link by email.
        </p>
      </div>
    );
  }

  return (
    <>
      {resentCredentials ? (
        <div className="mb-4">
          <InvitationLinkPanel
            {...resentCredentials}
            roleLabel="faculty administrator"
            onDismiss={() => setResentCredentials(null)}
          />
        </div>
      ) : null}
      <ul className="ula-admin-roster">
        {rows.map((row) => {
          const name = row.kind === 'active' ? row.admin.fullName : row.invite.fullName;
          const email = row.kind === 'active' ? row.admin.email : row.invite.email;
          const key = row.kind === 'active' ? `admin-${row.admin.id}` : `invite-${row.invite.id}`;
          const isPending = row.kind === 'pending';
          const isExpired = isPending && row.invite.lifecycleStatus === 'EXPIRED';
          const inviteId = isPending ? row.invite.id : null;
          const userId = row.kind === 'active' ? row.admin.id : null;

          return (
            <li key={key} className="ula-admin-roster-card">
              <div className="ula-admin-roster-card__main">
                <IdentityAvatar
                  name={name}
                  imageUrl={row.kind === 'active' ? row.admin.profilePhotoUrl : null}
                  size="md"
                />
                <div className="ula-admin-roster-card__identity">
                  <p className="ula-admin-roster-card__name">{name}</p>
                  <p className="ula-admin-roster-card__email">{email}</p>
                  {isPending ? (
                    <p className="ula-admin-roster-card__meta">
                      Invited {formatExpiry(row.invite.createdAt)}
                      {isExpired ? ' · expired' : ` · expires ${formatExpiry(row.invite.expiresAt)}`}
                    </p>
                  ) : row.admin.lastActiveAt ? (
                    <p className="ula-admin-roster-card__meta">
                      Last active {formatExpiry(row.admin.lastActiveAt)}
                    </p>
                  ) : null}
                </div>
                <div className={`ula-admin-status ${statusClass(row)}`}>
                  <span className="ula-admin-status__dot" aria-hidden />
                  {statusLabel(row)}
                </div>
              </div>

              <div className="ula-admin-roster-card__actions">
                {isPending && inviteId ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      className="ula-admin-action ula-admin-action--primary"
                      onClick={() => void resendInvite(inviteId, name, email)}
                    >
                      {actionKey === `resend-${inviteId}` ? (
                        <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                      ) : (
                        <i className="fa-solid fa-paper-plane" aria-hidden />
                      )}
                      {isExpired ? 'Resend invitation' : 'Resend invitation'}
                    </button>
                    {!isExpired ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="ula-admin-action"
                        onClick={() => void copyLink(inviteId)}
                      >
                        {actionKey === `copy-${inviteId}` ? (
                          <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                        ) : (
                          <i className="fa-solid fa-link" aria-hidden />
                        )}
                        Copy invitation link
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      className="ula-admin-action ula-admin-action--danger"
                      onClick={() => void revokeInvite(inviteId, name)}
                    >
                      {actionKey === `revoke-${inviteId}` ? (
                        <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                      ) : (
                        <i className="fa-solid fa-ban" aria-hidden />
                      )}
                      Deactivate
                    </button>
                  </>
                ) : userId ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="ula-admin-action ula-admin-action--danger"
                    onClick={() => void deactivateAdmin(userId, name)}
                  >
                    {actionKey === `deactivate-${userId}` ? (
                      <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                    ) : (
                      <i className="fa-solid fa-user-slash" aria-hidden />
                    )}
                    Deactivate
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {toast ? (
        <AdminToast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
      ) : null}
    </>
  );
}
