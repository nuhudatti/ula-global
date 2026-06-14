import { useState } from 'react';
import { api } from '../../lib/api';
import type { ArmInviteResult, ArmManagerRow } from '../../lib/arm';
import { InvitationStatusBadge } from '../platform/InvitationStatusBadge';
import { InvitationLinkPanel, type InvitationLinkResult } from '../InvitationLinkPanel';
import { AdminToast, type ToastTone } from '../admin/AdminToast';

export function ArmManagerRoster({
  rows,
  busy,
  onBusyChange,
  onChanged,
  onError,
}: {
  rows: ArmManagerRow[];
  busy: boolean;
  onBusyChange: (v: boolean) => void;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [resentCredentials, setResentCredentials] = useState<InvitationLinkResult | null>(null);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteResult, setInviteResult] = useState<InvitationLinkResult | null>(null);

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

  async function sendInvite() {
    const fullName = inviteName.trim();
    const email = inviteEmail.trim();
    if (!fullName || !email) {
      onError('Full name and email are required');
      return;
    }
    await runAction('invite', async () => {
      const res = await api<ArmInviteResult>('/api/admin/arm-managers/invite', {
        method: 'POST',
        body: JSON.stringify({ fullName, email }),
      });
      setInviteResult({
        fullName,
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
        res.emailSent ? 'Invitation sent by email. Link copied to clipboard.' : `Link copied.${res.emailError ? ` (${res.emailError})` : ''}`,
        res.emailSent ? 'success' : 'info',
      );
      setInviteName('');
      setInviteEmail('');
    });
  }

  async function resendInvite(inviteId: string, name: string, email: string) {
    await runAction(`resend-${inviteId}`, async () => {
      const res = await api<ArmInviteResult>(`/api/admin/arm-managers/invites/${inviteId}/resend`, { method: 'POST' });
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
      showToast(res.emailSent ? 'Invitation resent. Link copied.' : 'Link copied to clipboard.', res.emailSent ? 'success' : 'info');
    });
  }

  async function copyLink(inviteId: string) {
    await runAction(`copy-${inviteId}`, async () => {
      const res = await api<ArmInviteResult>(`/api/admin/arm-managers/invites/${inviteId}/activation-link`);
      const url = res.devActivationUrl || res.activationUrl || (res.inviteUrl ? `${window.location.origin}${res.inviteUrl}` : '');
      if (!url) throw new Error('No invitation link available');
      await navigator.clipboard.writeText(url);
      showToast('Invitation link copied.');
    });
  }

  async function revokeInvite(inviteId: string, name: string) {
    if (!confirm(`Cancel the invitation for ${name}?`)) return;
    await runAction(`revoke-${inviteId}`, async () => {
      await api(`/api/admin/arm-managers/invites/${inviteId}/revoke`, { method: 'POST' });
      showToast(`Invitation for ${name} cancelled.`);
    });
  }

  async function suspendManager(userId: string, name: string) {
    if (!confirm(`Suspend ${name}? They will lose upload access until reactivated.`)) return;
    await runAction(`suspend-${userId}`, async () => {
      await api(`/api/admin/arm-managers/${userId}/suspend`, { method: 'POST' });
      showToast(`${name} suspended.`);
    });
  }

  return (
    <div className="space-y-6">
      {inviteResult ? (
        <InvitationLinkPanel {...inviteResult} roleLabel="Academic Resources Manager" onDismiss={() => setInviteResult(null)} />
      ) : null}
      {resentCredentials ? (
        <InvitationLinkPanel {...resentCredentials} roleLabel="Academic Resources Manager" onDismiss={() => setResentCredentials(null)} />
      ) : null}
      {toast ? <AdminToast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} /> : null}

      <div className="ula-dept-surface p-5">
        <h3 className="text-sm font-semibold text-slate-900">Invite Academic Resources Manager</h3>
        <p className="mt-1 text-xs text-slate-500">
          They can upload past questions, lecture notes, and course materials across every faculty — without admin or billing access.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200"
            placeholder="Full name"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
          />
          <input
            className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200"
            placeholder="Work email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void sendInvite()}
          className="mt-3 rounded-xl bg-primary-700 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Send invitation
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="ula-admin-roster-empty">
          <div className="ula-admin-roster-empty__icon" aria-hidden>
            <i className="fa-solid fa-books" />
          </div>
          <h4 className="ula-admin-roster-empty__title">No resources managers yet</h4>
          <p className="ula-admin-roster-empty__text">Invite your first Academic Resources Manager to scale uploads institution-wide.</p>
        </div>
      ) : (
        <div className="ula-dept-surface overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const name = row.user?.fullName ?? row.invite?.fullName ?? '—';
                const email = row.user?.email ?? row.invite?.email ?? '';
                const inviteId = row.invite?.id;
                const userId = row.user?.id;
                const isPending = row.type === 'pending' || row.invitationStatus === 'PENDING' || row.invitationStatus === 'RESENT';

                return (
                  <tr key={`${row.type}-${userId ?? inviteId}`} className="border-b border-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{name}</p>
                      <p className="text-xs text-slate-500">{email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <InvitationStatusBadge status={row.invitationStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {isPending && inviteId ? (
                          <>
                            <button
                              type="button"
                              disabled={busy || actionKey === `resend-${inviteId}`}
                              className="text-xs font-semibold text-primary-800 hover:underline disabled:opacity-50"
                              onClick={() => void resendInvite(inviteId, name, email)}
                            >
                              Resend
                            </button>
                            <button
                              type="button"
                              disabled={busy || actionKey === `copy-${inviteId}`}
                              className="text-xs font-semibold text-slate-600 hover:underline disabled:opacity-50"
                              onClick={() => void copyLink(inviteId)}
                            >
                              Copy link
                            </button>
                            <button
                              type="button"
                              disabled={busy || actionKey === `revoke-${inviteId}`}
                              className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
                              onClick={() => void revokeInvite(inviteId, name)}
                            >
                              Revoke
                            </button>
                          </>
                        ) : null}
                        {row.type === 'active' && userId && row.user?.accountStatus !== 'SUSPENDED' ? (
                          <button
                            type="button"
                            disabled={busy || actionKey === `suspend-${userId}`}
                            className="text-xs font-semibold text-amber-800 hover:underline disabled:opacity-50"
                            onClick={() => void suspendManager(userId, name)}
                          >
                            Suspend
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
