import { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { FacultyPendingInvite, FacultyPerson, FacultyPersonnelTab } from '../../lib/faculty';
import { STATUS_LABELS } from '../../lib/department';
import { IdentityAvatar } from '../IdentityAvatar';
import { AdminToast, type ToastTone } from '../admin/AdminToast';
import { InvitationLinkPanel, type InvitationLinkResult } from '../InvitationLinkPanel';
import '../../styles/admin-workspace.css';

type ResendResult = InvitationLinkResult;

const ROLE_LABELS: Record<string, string> = {
  HOD: 'Head of Department',
  LECTURER: 'Lecturer',
  DEPARTMENT_ADMIN: 'Department Admin',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function inviteExpired(inv: FacultyPendingInvite) {
  return new Date(inv.expiresAt) < new Date();
}

export function FacultyPeople({
  people,
  pendingInvites,
  loading,
  onRefresh,
}: {
  people: FacultyPerson[];
  pendingInvites: FacultyPendingInvite[];
  loading: boolean;
  onRefresh: () => void | Promise<void>;
}) {
  const [tab, setTab] = useState<FacultyPersonnelTab>('all');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [credentials, setCredentials] = useState<InvitationLinkResult | null>(null);

  const leaders = useMemo(() => people.filter((p) => p.role === 'HOD'), [people]);

  const departments = useMemo(() => {
    const names = new Map<string, string>();
    for (const p of leaders) names.set(p.department.id, p.department.name);
    for (const inv of pendingInvites) names.set(inv.department.id, inv.department.name);
    return [...names.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [leaders, pendingInvites]);

  const stats = useMemo(() => {
    const active = leaders.filter((p) => p.accountStatus === 'ACTIVE').length;
    const inactive = leaders.filter((p) => p.accountStatus !== 'ACTIVE').length;
    return {
      total: leaders.length,
      active,
      inactive,
      pending: pendingInvites.length,
      hods: leaders.length,
    };
  }, [leaders, pendingInvites]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaders.filter((p) => {
      if (deptFilter && p.department.id !== deptFilter) return false;
      if (tab === 'active' && p.accountStatus !== 'ACTIVE') return false;
      if (tab === 'inactive' && p.accountStatus === 'ACTIVE') return false;
      if (tab === 'pending') return false;
      if (!q) return true;
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.staffId && p.staffId.toLowerCase().includes(q)) ||
        p.department.name.toLowerCase().includes(q)
      );
    });
  }, [leaders, search, deptFilter, tab]);

  const filteredInvites = useMemo(() => {
    if (tab !== 'pending' && tab !== 'all') return [];
    const q = search.trim().toLowerCase();
    return pendingInvites.filter((inv) => {
      if (deptFilter && inv.department.id !== deptFilter) return false;
      if (tab === 'pending' || tab === 'all') {
        if (!q) return true;
        return (
          inv.fullName.toLowerCase().includes(q) ||
          inv.email.toLowerCase().includes(q) ||
          inv.department.name.toLowerCase().includes(q)
        );
      }
      return false;
    });
  }, [pendingInvites, search, deptFilter, tab]);

  function showToast(message: string, tone: ToastTone = 'success') {
    setToast({ message, tone });
  }

  async function runAction(key: string, fn: () => Promise<void>) {
    setBusyKey(key);
    try {
      await fn();
      await onRefresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Action failed', 'error');
    } finally {
      setBusyKey(null);
    }
  }

  async function setStatus(userId: string, accountStatus: string, name: string) {
    const label = accountStatus === 'ACTIVE' ? 'activated' : 'deactivated';
    await runAction(`status-${userId}`, async () => {
      await api(`/api/faculty/people/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ accountStatus }),
      });
      showToast(`${name} has been ${label}.`);
    });
  }

  async function resendInvite(inviteId: string, name: string, email: string) {
    await runAction(`resend-inv-${inviteId}`, async () => {
      const res = await api<ResendResult>(`/api/faculty/people/invites/${inviteId}/resend`, { method: 'POST' });
      setCredentials({
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

  async function resendUserInvite(userId: string, name: string, email: string) {
    await runAction(`resend-user-${userId}`, async () => {
      const res = await api<ResendResult>(`/api/faculty/people/${userId}/resend-invite`, { method: 'POST' });
      setCredentials({
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
      showToast('Invitation link refreshed and copied.');
    });
  }

  async function copyActivationLink(inviteId: string) {
    await runAction(`copy-${inviteId}`, async () => {
      const res = await api<ResendResult>(`/api/faculty/people/invites/${inviteId}/activation-link`);
      const url = res.devActivationUrl || res.activationUrl || (res.inviteUrl ? `${window.location.origin}${res.inviteUrl}` : '');
      if (!url) throw new Error('No invitation link available');
      await navigator.clipboard.writeText(url);
      showToast('Invitation link copied to clipboard.');
    });
  }

  async function revokeInvite(inviteId: string, name: string) {
    if (!confirm(`Cancel the invitation for ${name}? They will no longer be able to activate with this link.`)) return;
    await runAction(`revoke-${inviteId}`, async () => {
      await api(`/api/faculty/people/invites/${inviteId}/revoke`, { method: 'POST' });
      showToast(`Invitation for ${name} cancelled.`);
    });
  }

  const tabs: { id: FacultyPersonnelTab; label: string; count: number }[] = [
    { id: 'all', label: 'All leaders', count: stats.total + stats.pending },
    { id: 'active', label: 'Active', count: stats.active },
    { id: 'inactive', label: 'Inactive', count: stats.inactive },
    { id: 'pending', label: 'Pending', count: stats.pending },
  ];

  return (
    <div className="ula-faculty-personnel ula-dept-animate-in w-full max-w-6xl">
      <header className="ula-faculty-personnel__header">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f4c81]">Personnel</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Department leaders</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Heads of Department across your faculty. To add or change leaders, use the Departments section. Lecturer
            management stays inside each department workspace.
          </p>
        </div>
      </header>

      <div className="ula-faculty-personnel__kpis">
        <div className="ula-faculty-personnel__kpi">
          <p className="ula-faculty-personnel__kpi-label">Total staff</p>
          <p className="ula-faculty-personnel__kpi-value">{stats.total}</p>
        </div>
        <div className="ula-faculty-personnel__kpi" data-tone="active">
          <p className="ula-faculty-personnel__kpi-label">Active</p>
          <p className="ula-faculty-personnel__kpi-value">{stats.active}</p>
        </div>
        <div className="ula-faculty-personnel__kpi" data-tone="inactive">
          <p className="ula-faculty-personnel__kpi-label">Inactive</p>
          <p className="ula-faculty-personnel__kpi-value">{stats.inactive}</p>
        </div>
        <div className="ula-faculty-personnel__kpi" data-tone="pending">
          <p className="ula-faculty-personnel__kpi-label">Pending invites</p>
          <p className="ula-faculty-personnel__kpi-value">{stats.pending}</p>
        </div>
        <div className="ula-faculty-personnel__kpi">
          <p className="ula-faculty-personnel__kpi-label">HODs</p>
          <p className="ula-faculty-personnel__kpi-value">{stats.hods}</p>
        </div>
      </div>

      {credentials ? (
        <InvitationLinkPanel
          {...credentials}
          roleLabel="Head of Department"
          onDismiss={() => setCredentials(null)}
        />
      ) : null}

      <div className="ula-faculty-personnel__toolbar">
        <div className="ula-faculty-personnel__tabs" role="tablist" aria-label="Personnel filters">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              data-active={tab === t.id}
              className="ula-faculty-personnel__tab"
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span className="ula-faculty-personnel__tab-count">{t.count}</span>
            </button>
          ))}
        </div>
        <div className="ula-faculty-personnel__filters">
          <div className="relative min-w-[220px] flex-1">
            <i
              className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"
              aria-hidden
            />
            <input
              className="ula-dept-search w-full"
              placeholder="Search by name, email, or department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="ula-dept-search min-w-[180px]"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            aria-label="Filter by department"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="ula-dept-surface flex min-h-[280px] items-center justify-center">
          <p className="inline-flex items-center gap-2 text-sm text-slate-500">
            <i className="fa-solid fa-spinner fa-spin text-[#0f4c81]" aria-hidden />
            Loading academic personnel…
          </p>
        </div>
      ) : tab === 'pending' || (tab === 'all' && filteredInvites.length > 0) ? (
        <div className="space-y-6">
          {(tab === 'pending' || tab === 'all') && filteredInvites.length > 0 ? (
            <section>
              {tab === 'all' ? (
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-700">Pending invitations</h3>
              ) : null}
              <ul className="ula-admin-roster">
                {filteredInvites.map((inv) => {
                  const expired = inviteExpired(inv);
                  return (
                    <li key={inv.id} className="ula-admin-roster-card">
                      <div className="ula-admin-roster-card__main">
                        <IdentityAvatar name={inv.fullName} size="md" />
                        <div className="ula-admin-roster-card__identity">
                          <p className="ula-admin-roster-card__name">{inv.fullName}</p>
                          <p className="ula-admin-roster-card__email">{inv.email}</p>
                          <p className="ula-admin-roster-card__meta">
                            {inv.department.name} · {ROLE_LABELS[inv.departmentRole] ?? inv.departmentRole}
                            {' · '}
                            Invited {formatDate(inv.createdAt)}
                            {expired ? ' · expired' : ` · expires ${formatDate(inv.expiresAt)}`}
                          </p>
                        </div>
                        <div className={`ula-admin-status ${expired ? 'ula-admin-status--expired' : 'ula-admin-status--pending'}`}>
                          <span className="ula-admin-status__dot" aria-hidden />
                          {expired ? 'Expired' : 'Pending'}
                        </div>
                      </div>
                      <div className="ula-admin-roster-card__actions">
                        <button
                          type="button"
                          disabled={!!busyKey}
                          className="ula-admin-action ula-admin-action--primary"
                          onClick={() => void resendInvite(inv.id, inv.fullName, inv.email)}
                        >
                          {busyKey === `resend-inv-${inv.id}` ? (
                            <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                          ) : (
                            <i className="fa-solid fa-paper-plane" aria-hidden />
                          )}
                          Resend invitation
                        </button>
                        {!expired ? (
                          <button
                            type="button"
                            disabled={!!busyKey}
                            className="ula-admin-action"
                            onClick={() => void copyActivationLink(inv.id)}
                          >
                            {busyKey === `copy-${inv.id}` ? (
                              <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                            ) : (
                              <i className="fa-solid fa-link" aria-hidden />
                            )}
                            Copy invitation link
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={!!busyKey}
                          className="ula-admin-action ula-admin-action--danger"
                          onClick={() => void revokeInvite(inv.id, inv.fullName)}
                        >
                          {busyKey === `revoke-${inv.id}` ? (
                            <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                          ) : (
                            <i className="fa-solid fa-ban" aria-hidden />
                          )}
                          Deactivate
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : tab === 'pending' ? (
            <div className="ula-admin-roster-empty">
              <div className="ula-admin-roster-empty__icon" aria-hidden>
                <i className="fa-solid fa-envelope-open-text" />
              </div>
              <h4 className="ula-admin-roster-empty__title">No pending invitations</h4>
              <p className="ula-admin-roster-empty__text">
                Pending Head of Department invitations appear here after you send them from the Departments section.
              </p>
            </div>
          ) : null}

          {tab === 'all' && filteredPeople.length > 0 ? (
            <section>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Assigned HODs</h3>
              <PersonnelRoster
                rows={filteredPeople}
                busyKey={busyKey}
                onActivate={(id, name) => void setStatus(id, 'ACTIVE', name)}
                onDeactivate={(id, name) => void setStatus(id, 'SUSPENDED', name)}
                onResendUser={(id, name, email) => void resendUserInvite(id, name, email)}
              />
            </section>
          ) : null}
        </div>
      ) : filteredPeople.length === 0 ? (
        <div className="ula-admin-roster-empty">
          <div className="ula-admin-roster-empty__icon" aria-hidden>
            <i className="fa-solid fa-users" />
          </div>
          <h4 className="ula-admin-roster-empty__title">No personnel match this view</h4>
          <p className="ula-admin-roster-empty__text">
            {tab === 'active'
              ? 'No active staff yet — assign HODs from Department governance or wait for invite activations.'
              : tab === 'inactive'
                ? 'No inactive accounts — suspended or pending staff will appear here.'
                : 'Start by creating departments and inviting heads of department.'}
          </p>
        </div>
      ) : (
        <PersonnelRoster
          rows={filteredPeople}
          busyKey={busyKey}
          onActivate={(id, name) => void setStatus(id, 'ACTIVE', name)}
          onDeactivate={(id, name) => void setStatus(id, 'SUSPENDED', name)}
          onResendUser={(id, name, email) => void resendUserInvite(id, name, email)}
        />
      )}

      {toast ? <AdminToast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}

function PersonnelRoster({
  rows,
  busyKey,
  onActivate,
  onDeactivate,
  onResendUser,
}: {
  rows: FacultyPerson[];
  busyKey: string | null;
  onActivate: (id: string, name: string) => void;
  onDeactivate: (id: string, name: string) => void;
  onResendUser: (id: string, name: string, email: string) => void;
}) {
  return (
    <ul className="ula-admin-roster">
      {rows.map((p) => {
        const isActive = p.accountStatus === 'ACTIVE';
        const isPending = p.accountStatus === 'PENDING';
        const roleLabel = ROLE_LABELS[p.role] ?? p.role;

        return (
          <li key={p.id} className="ula-admin-roster-card">
            <div className="ula-admin-roster-card__main">
              <IdentityAvatar name={p.fullName} imageUrl={p.profilePhotoUrl} size="md" />
              <div className="ula-admin-roster-card__identity">
                <p className="ula-admin-roster-card__name">{p.fullName}</p>
                <p className="ula-admin-roster-card__email">{p.email}</p>
                <p className="ula-admin-roster-card__meta">
                  {p.department.name} · {roleLabel}
                  {p.staffId ? ` · ${p.staffId}` : ''}
                  {p._count.uploads > 0 ? ` · ${p._count.uploads} publications` : ''}
                </p>
              </div>
              <div
                className={`ula-admin-status ${
                  isActive ? 'ula-admin-status--active' : isPending ? 'ula-admin-status--pending' : 'ula-admin-status--expired'
                }`}
              >
                <span className="ula-admin-status__dot" aria-hidden />
                {STATUS_LABELS[p.accountStatus] ?? p.accountStatus}
              </div>
            </div>
            <div className="ula-admin-roster-card__actions">
              {isPending ? (
                <button
                  type="button"
                  disabled={!!busyKey}
                  className="ula-admin-action ula-admin-action--primary"
                  onClick={() => onResendUser(p.id, p.fullName, p.email)}
                >
                  {busyKey === `resend-user-${p.id}` ? (
                    <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                  ) : (
                    <i className="fa-solid fa-paper-plane" aria-hidden />
                  )}
                  Resend invitation
                </button>
              ) : isActive ? (
                <button
                  type="button"
                  disabled={!!busyKey}
                  className="ula-admin-action ula-admin-action--danger"
                  onClick={() => onDeactivate(p.id, p.fullName)}
                >
                  {busyKey === `status-${p.id}` ? (
                    <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                  ) : (
                    <i className="fa-solid fa-user-slash" aria-hidden />
                  )}
                  Deactivate
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!!busyKey}
                  className="ula-admin-action ula-admin-action--primary"
                  onClick={() => onActivate(p.id, p.fullName)}
                >
                  {busyKey === `status-${p.id}` ? (
                    <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                  ) : (
                    <i className="fa-solid fa-user-check" aria-hidden />
                  )}
                  Activate
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
