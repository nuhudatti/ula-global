import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { platformApi } from '../../lib/platformApi';
import { InvitationStatusBadge } from './InvitationStatusBadge';
import { ProvisionResultModal } from './ProvisionResultModal';
import { TenantStatusBadge } from './TenantStatusBadge';

type TenantAdmin = {
  id: string | null;
  email: string;
  fullName: string;
  accountStatus: string;
  mustChangePassword: boolean;
  activated: boolean;
  lastActiveAt: string | null;
};

type TenantInvitation = {
  id: string | null;
  status: string;
  email: string | null;
  expiresAt: string | null;
  resentCount: number;
  canCopyLink: boolean;
  canResend: boolean;
  canRevoke: boolean;
};

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  status: string;
  contactEmail: string | null;
  createdAt: string;
  loginUrl: string;
  workspaceUrl: string;
  adminUrl: string;
  admin: TenantAdmin | null;
  invitation: TenantInvitation;
  lastActivityAt: string | null;
  _count: { users: number; faculties: number };
};

type TenantStats = {
  users: number;
  activeUsers: number;
  resources: number;
  submissions: number;
  faculties: number;
  storageBytes: number;
  health: string;
};

type InvitationResult = {
  institution: { slug: string; name: string };
  adminEmail: string;
  adminName: string;
  loginUrl: string;
  invitationUrl?: string;
  inviteUrl?: string;
  devActivationUrl?: string;
  emailSent: boolean;
  emailMode?: string;
  invitationStatus?: string;
};

type StatusFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'SUSPENDED', label: 'Suspended' },
  { id: 'ARCHIVED', label: 'Archived' },
];

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

function formatWhen(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function TenantManagement() {
  const [items, setItems] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [inviteResult, setInviteResult] = useState<InvitationResult | null>(null);
  const [inviteModalTitle, setInviteModalTitle] = useState('Institution provisioned');
  const [form, setForm] = useState({
    name: '',
    shortName: '',
    slug: '',
    contactEmail: '',
    website: '',
    adminEmail: '',
    adminName: '',
    primaryColor: '#14532d',
    secondaryColor: '#166534',
  });

  const counts = useMemo(() => {
    const all = items.length;
    const active = items.filter((t) => t.status === 'ACTIVE').length;
    const suspended = items.filter((t) => t.status === 'SUSPENDED').length;
    const archived = items.filter((t) => t.status === 'ARCHIVED').length;
    return { all, active, suspended, archived };
  }, [items]);

  const refresh = useCallback(async () => {
    const data = await platformApi<{ items: TenantRow[] }>('/api/platform/tenants');
    setItems(data.items);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const filteredItems = useMemo(() => {
    if (statusFilter === 'ALL') return items;
    return items.filter((t) => t.status === statusFilter);
  }, [items, statusFilter]);

  function showInviteResult(result: InvitationResult, title: string) {
    setInviteModalTitle(title);
    setInviteResult(result);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = await platformApi<InvitationResult & { institution: TenantRow }>(
        '/api/platform/tenants',
        { method: 'POST', body: JSON.stringify(form) },
      );
      showInviteResult(
        {
          institution: { slug: result.institution.slug, name: result.institution.name },
          adminEmail: result.adminEmail,
          adminName: result.adminName,
          loginUrl: result.loginUrl,
          invitationUrl: result.invitationUrl,
          inviteUrl: result.inviteUrl,
          devActivationUrl: result.devActivationUrl,
          emailSent: result.emailSent,
          emailMode: result.emailMode,
          invitationStatus: result.invitationStatus,
        },
        'Institution provisioned',
      );
      setMessage(`Created /${result.institution.slug}. Invitation ${result.emailSent ? 'sent' : 'queued to outbox'}.`);
      setShowCreate(false);
      setForm({
        name: '',
        shortName: '',
        slug: '',
        contactEmail: '',
        website: '',
        adminEmail: '',
        adminName: '',
        primaryColor: '#14532d',
        secondaryColor: '#166534',
      });
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleStats(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setStats(null);
      return;
    }
    setExpandedId(id);
    try {
      const data = await platformApi<TenantStats>(`/api/platform/tenants/${id}/stats`);
      setStats(data);
    } catch {
      setStats(null);
    }
  }

  async function copyInvitationLink(tenant: TenantRow) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await platformApi<{ activationUrl: string; inviteUrl: string }>(
        `/api/platform/tenants/${tenant.id}/invitation/link`,
      );
      await copyText(result.activationUrl);
      setMessage(`Invitation link copied for ${tenant.name}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not copy invitation link');
    } finally {
      setBusy(false);
    }
  }

  async function resendInvitation(tenant: TenantRow) {
    const email = tenant.admin?.email ?? tenant.invitation.email;
    if (!email) {
      setMessage('No administrator email on record.');
      return;
    }
    if (!window.confirm(`Resend the invitation email to ${email}?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await platformApi<InvitationResult>(
        `/api/platform/tenants/${tenant.id}/invitation/resend`,
        { method: 'POST' },
      );
      showInviteResult(result, 'Invitation resent');
      setMessage(`Invitation resent to ${result.adminEmail}.`);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Resend failed');
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvitation(tenant: TenantRow) {
    if (!window.confirm(`Revoke the pending invitation for ${tenant.name}?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await platformApi(`/api/platform/tenants/${tenant.id}/invitation/revoke`, { method: 'POST' });
      setMessage(`Invitation revoked for ${tenant.name}.`);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Revoke failed');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusy(true);
    try {
      await platformApi(`/api/platform/tenants/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await refresh();
      setMessage(`Institution status updated to ${status.toLowerCase()}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading institutions…</p>;
  }

  return (
    <div className="max-w-6xl space-y-6">
      {inviteResult ? (
        <ProvisionResultModal
          result={inviteResult}
          title={inviteModalTitle}
          subtitle={
            inviteModalTitle === 'Invitation resent'
              ? 'A new invitation email was'
              : 'An invitation email was'
          }
          onClose={() => setInviteResult(null)}
        />
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Tenants</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Institution management</h2>
          <p className="mt-2 text-sm text-slate-500">
            Provision institutions and manage administrator invitation onboarding.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Create institution
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f.id === 'ALL' ? counts.all : f.id === 'ACTIVE' ? counts.active : f.id === 'SUSPENDED' ? counts.suspended : counts.archived;
          return (
            <button
              key={f.id}
              type="button"
              data-active={statusFilter === f.id}
              onClick={() => setStatusFilter(f.id)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 data-[active=true]:border-slate-900 data-[active=true]:bg-slate-900 data-[active=true]:text-white"
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {message ? <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-800">{message}</div> : null}

      {showCreate ? (
        <form onSubmit={(e) => void onCreate(e)} className="ula-platform-kpi grid gap-4 sm:grid-cols-2">
          <h3 className="sm:col-span-2 font-semibold text-slate-900">New institution</h3>
          <p className="sm:col-span-2 text-sm text-slate-500">
            No password is set here — the administrator receives a secure invitation link to choose their own password.
          </p>
          {(['name', 'shortName', 'slug', 'contactEmail', 'website', 'adminEmail', 'adminName'] as const).map((key) => (
            <label key={key} className="text-sm">
              <span className="mb-1 block font-medium capitalize text-slate-700">{key.replace(/([A-Z])/g, ' $1')}</span>
              <input
                required={['name', 'shortName', 'slug', 'adminEmail'].includes(key)}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          ))}
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Provision &amp; send invitation
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="ula-platform-kpi overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="pb-2">Institution</th>
              <th className="pb-2">Admin name</th>
              <th className="pb-2">Admin email</th>
              <th className="pb-2">Invitation</th>
              <th className="pb-2">Created</th>
              <th className="pb-2">Last activity</th>
              <th className="pb-2">Status</th>
              <th className="pb-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.map((t) => (
              <Fragment key={t.id}>
                <tr>
                  <td className="py-3 align-top">
                    <button type="button" onClick={() => void toggleStats(t.id)} className="text-left">
                      <p className="font-medium text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-400">/{t.slug}</p>
                    </button>
                  </td>
                  <td className="py-3 align-top text-slate-800">{t.admin?.fullName ?? '—'}</td>
                  <td className="py-3 align-top text-xs text-slate-600">{t.admin?.email ?? t.invitation.email ?? '—'}</td>
                  <td className="py-3 align-top">
                    <InvitationStatusBadge status={t.invitation.status} />
                  </td>
                  <td className="py-3 align-top text-xs text-slate-600">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 align-top text-xs text-slate-600">{formatWhen(t.lastActivityAt)}</td>
                  <td className="py-3 align-top">
                    <TenantStatusBadge status={t.status} />
                  </td>
                  <td className="py-3 align-top">
                    <div className="flex flex-wrap justify-end gap-1">
                      <button type="button" disabled={busy} onClick={() => void toggleStats(t.id)} className="rounded border px-2 py-1 text-xs">
                        Details
                      </button>
                      {t.invitation.canCopyLink ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void copyInvitationLink(t)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                        >
                          Copy link
                        </button>
                      ) : null}
                      {t.invitation.canResend && t.status !== 'ARCHIVED' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void resendInvitation(t)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                        >
                          Resend
                        </button>
                      ) : null}
                      {t.invitation.canRevoke ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void revokeInvitation(t)}
                          className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700"
                        >
                          Revoke
                        </button>
                      ) : null}
                      {t.status === 'ARCHIVED' ? (
                        <button type="button" disabled={busy} onClick={() => void setStatus(t.id, 'ACTIVE')} className="rounded border px-2 py-1 text-xs">
                          Restore
                        </button>
                      ) : t.status !== 'ACTIVE' ? (
                        <button type="button" disabled={busy} onClick={() => void setStatus(t.id, 'ACTIVE')} className="rounded border px-2 py-1 text-xs">
                          Activate
                        </button>
                      ) : (
                        <>
                          <button type="button" disabled={busy} onClick={() => void setStatus(t.id, 'SUSPENDED')} className="rounded border border-amber-200 px-2 py-1 text-xs text-amber-900">
                            Suspend
                          </button>
                          <button type="button" disabled={busy} onClick={() => void setStatus(t.id, 'ARCHIVED')} className="rounded border px-2 py-1 text-xs text-slate-600">
                            Archive
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedId === t.id ? (
                  <tr>
                    <td colSpan={8} className="bg-slate-50 px-4 py-4">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-3 text-sm">
                          <h4 className="font-semibold text-slate-900">Workspace links</h4>
                          {[
                            { label: 'Public browse', url: t.workspaceUrl },
                            { label: 'Institution login', url: t.loginUrl },
                            { label: 'Admin console', url: t.adminUrl },
                          ].map((link) => (
                            <div key={link.label} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{link.label}</p>
                                <p className="font-mono text-xs text-slate-700">{link.url}</p>
                              </div>
                              <div className="flex gap-1">
                                <button type="button" onClick={() => void copyText(link.url)} className="rounded border px-2 py-1 text-xs">
                                  Copy
                                </button>
                                <a href={link.url} target="_blank" rel="noopener noreferrer" className="rounded border px-2 py-1 text-xs">
                                  Open
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-3 text-sm">
                          <h4 className="font-semibold text-slate-900">Usage</h4>
                          {stats ? (
                            <ul className="space-y-1 text-xs text-slate-600">
                              <li>Active users: {stats.activeUsers}</li>
                              <li>Resources: {stats.resources}</li>
                              <li>Submissions: {stats.submissions}</li>
                              <li>Faculties: {stats.faculties}</li>
                              <li>Storage: {(stats.storageBytes / 1024 / 1024).toFixed(1)} MB</li>
                              <li>Health: {stats.health}</li>
                            </ul>
                          ) : (
                            <p className="text-xs text-slate-400">Loading usage…</p>
                          )}
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                            <p>Users: {t._count.users}</p>
                            <p>Faculties: {t._count.faculties}</p>
                            {t.invitation.expiresAt ? (
                              <p className="mt-2">Invitation expires: {formatWhen(t.invitation.expiresAt)}</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
        {filteredItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No institutions match this filter.</p>
        ) : null}
      </div>
    </div>
  );
}
