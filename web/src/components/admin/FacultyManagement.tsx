import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { AdminFacultyDetail, AdminFacultyRow, InviteAdminResult, UserLookup } from '../../lib/adminFaculties';
import { FacultyAdminRoster } from './FacultyAdminRoster';
import { InvitationLinkPanel, type InvitationLinkResult } from '../InvitationLinkPanel';

const inputCls =
  'w-full rounded-xl border-0 bg-slate-50/90 py-2.5 px-3.5 text-sm text-slate-800 ring-1 ring-slate-200/90 focus:ring-2 focus:ring-primary-500/40';

type FormMode = 'create' | 'edit' | null;

export function FacultyManagement({
  selectedFacultyId,
  onSelectFaculty,
  onRefresh,
}: {
  selectedFacultyId?: string | null;
  onSelectFaculty?: (id: string) => void;
  onRefresh?: () => void;
}) {
  const [faculties, setFaculties] = useState<AdminFacultyRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(selectedFacultyId ?? null);
  const [detail, setDetail] = useState<AdminFacultyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formTagline, setFormTagline] = useState('');

  const [assignEmail, setAssignEmail] = useState('');
  const [lookup, setLookup] = useState<UserLookup | null>(null);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminTab, setAdminTab] = useState<'assign' | 'invite'>('invite');
  const [inviteCredentials, setInviteCredentials] = useState<InvitationLinkResult | null>(null);

  const loadList = useCallback(async () => {
    const rows = await api<AdminFacultyRow[]>('/api/admin/faculties');
    setFaculties(rows);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const d = await api<AdminFacultyDetail>(`/api/admin/faculties/${id}`);
    setDetail(d);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadList();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Could not load faculties');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadList]);

  useEffect(() => {
    if (selectedFacultyId) setExpandedId(selectedFacultyId);
  }, [selectedFacultyId]);

  useEffect(() => {
    if (!expandedId) {
      setDetail(null);
      return;
    }
    void loadDetail(expandedId).catch((e) => setErr(e instanceof Error ? e.message : 'Could not load detail'));
  }, [expandedId, loadDetail]);

  function afterChange() {
    void loadList();
    if (expandedId) void loadDetail(expandedId);
    onRefresh?.();
  }

  function openCreate() {
    setFormMode('create');
    setEditId(null);
    setFormName('');
    setFormCode('');
    setFormTagline('');
    setErr(null);
  }

  function openEdit(f: AdminFacultyRow) {
    setFormMode('edit');
    setEditId(f.id);
    setFormName(f.name);
    setFormCode(f.code);
    setFormTagline(f.tagline ?? '');
    setErr(null);
  }

  async function saveFaculty() {
    if (!formName.trim() || !formCode.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      if (formMode === 'create') {
        await api('/api/admin/faculties', {
          method: 'POST',
          body: JSON.stringify({ name: formName, code: formCode, tagline: formTagline || null }),
        });
        setMsg('Faculty created.');
      } else if (editId) {
        await api(`/api/admin/faculties/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: formName, code: formCode, tagline: formTagline || null }),
        });
        setMsg('Faculty updated.');
      }
      setFormMode(null);
      afterChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function removeFaculty(f: AdminFacultyRow) {
    if (!confirm(`Delete "${f.name}"? Only empty faculties with no admins can be removed.`)) return;
    setBusy(true);
    try {
      await api(`/api/admin/faculties/${f.id}`, { method: 'DELETE' });
      setMsg(`"${f.name}" removed.`);
      if (expandedId === f.id) setExpandedId(null);
      afterChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  async function lookupUser() {
    if (!assignEmail.trim()) return;
    setLookup(null);
    setErr(null);
    try {
      const u = await api<UserLookup>(`/api/admin/users/lookup?email=${encodeURIComponent(assignEmail.trim())}`);
      setLookup(u);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'User not found');
    }
  }

  async function assignAdmin(facultyId: string) {
    if (!lookup) return;
    setBusy(true);
    try {
      await api(`/api/admin/faculties/${facultyId}/admins/assign`, {
        method: 'POST',
        body: JSON.stringify({ userId: lookup.id }),
      });
      setMsg(`${lookup.fullName} assigned as faculty administrator.`);
      setAssignEmail('');
      setLookup(null);
      afterChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setBusy(false);
    }
  }

  async function inviteAdmin(facultyId: string) {
    if (!newAdminEmail.trim() || !newAdminName.trim()) return;
    setBusy(true);
    setInviteCredentials(null);
    try {
      const res = await api<InviteAdminResult>(`/api/admin/faculties/${facultyId}/admins/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: newAdminEmail, fullName: newAdminName }),
      });
      setInviteCredentials({
        fullName: res.invite.fullName,
        email: res.invite.email,
        inviteUrl: res.inviteUrl,
        activationUrl: res.activationUrl,
        devActivationUrl: res.devActivationUrl,
        emailSent: res.emailSent,
        emailError: res.emailError,
      });
      setNewAdminEmail('');
      setNewAdminName('');
      afterChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Invitation failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ula-dept-animate-in max-w-5xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700">Structure</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Faculty management</h2>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Create faculties and assign administrators. Each faculty admin handles their own branding and
            department governance from their faculty workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-800"
        >
          <i className="fa-solid fa-plus mr-1.5 text-xs" aria-hidden />
          New faculty
        </button>
      </header>

      {msg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{msg}</div>
      ) : null}
      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      ) : null}

      {formMode ? (
        <div className="ula-dept-surface space-y-4 p-6">
          <h3 className="font-semibold text-slate-900">{formMode === 'create' ? 'Create faculty' : 'Edit faculty'}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Name</label>
              <input className={inputCls} value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Applied Sciences" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Code</label>
              <input
                className={inputCls}
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="FAC_SCI"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Tagline (optional)</label>
            <input
              className={inputCls}
              value={formTagline}
              onChange={(e) => setFormTagline(e.target.value)}
              placeholder="Learning for Service"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveFaculty()}
              className="rounded-xl bg-primary-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {formMode === 'create' ? 'Create faculty' : 'Save changes'}
            </button>
            <button type="button" onClick={() => setFormMode(null)} className="rounded-xl px-4 py-2 text-sm text-slate-600">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading faculties…</p>
      ) : faculties.length === 0 ? (
        <div className="ula-dept-surface px-8 py-14 text-center">
          <h3 className="font-semibold text-slate-900">No faculties yet</h3>
          <p className="mt-2 text-sm text-slate-500">Create the first academic faculty to begin platform governance.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {faculties.map((f) => {
            const expanded = expandedId === f.id;
            const selected = selectedFacultyId === f.id;
            return (
              <article
                key={f.id}
                className="ula-admin-faculty-card"
                data-expanded={expanded}
                style={selected ? { borderColor: 'rgba(22, 101, 52, 0.25)' } : undefined}
              >
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">{f.name}</h3>
                        <span className="ula-admin-badge ula-admin-badge--live">{f.code}</span>
                        {f.departmentCount === 0 ? (
                          <span className="ula-admin-badge ula-admin-badge--empty">No departments</span>
                        ) : null}
                      </div>
                      {f.tagline ? <p className="mt-1 text-sm text-slate-500">{f.tagline}</p> : null}
                      <p className="mt-2 text-xs text-slate-400">
                        {f.departmentCount} department{f.departmentCount === 1 ? '' : 's'} · {f.adminCount} administrator
                        {f.adminCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(f)}
                        className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = expanded ? null : f.id;
                          setExpandedId(next);
                          if (next) onSelectFaculty?.(next);
                        }}
                        className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white"
                      >
                        {expanded ? 'Close' : 'Manage'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeFaculty(f)}
                        className="rounded-xl border border-red-200 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {expanded && detail?.id === f.id ? (
                    <div className="mt-6 border-t border-slate-100 pt-6 space-y-6">
                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        <span>
                          <strong className="text-slate-800">{detail.lecturerCount}</strong> academic staff
                        </span>
                        <span>
                          <strong className="text-slate-800">{detail.departmentCount}</strong> departments
                        </span>
                      </div>

                      <div>
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900">Faculty administrators</h4>
                            <p className="mt-1 text-xs text-slate-500">
                              Pending invites appear until activation. Active admins can be deactivated anytime.
                            </p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <FacultyAdminRoster
                            facultyId={f.id}
                            admins={detail.admins}
                            pendingInvites={detail.pendingInvites ?? []}
                            busy={busy}
                            onBusyChange={setBusy}
                            onChanged={afterChange}
                            onError={setErr}
                          />
                        </div>
                      </div>

                      <div className="ula-dept-surface p-5 space-y-4">
                        {inviteCredentials ? (
                          <InvitationLinkPanel
                            {...inviteCredentials}
                            roleLabel="faculty administrator"
                            onDismiss={() => setInviteCredentials(null)}
                          />
                        ) : null}

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setAdminTab('invite');
                              setInviteCredentials(null);
                            }}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${adminTab === 'invite' ? 'bg-primary-700 text-white' : 'bg-slate-100 text-slate-600'}`}
                          >
                            Invite administrator
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdminTab('assign')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${adminTab === 'assign' ? 'bg-primary-700 text-white' : 'bg-slate-100 text-slate-600'}`}
                          >
                            Assign existing user
                          </button>
                        </div>

                        {adminTab === 'invite' ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input
                              className={inputCls}
                              placeholder="Full name — e.g. Dr. Ibrahim"
                              value={newAdminName}
                              onChange={(e) => setNewAdminName(e.target.value)}
                            />
                            <input
                              className={inputCls}
                              type="email"
                              placeholder="Institutional email"
                              value={newAdminEmail}
                              onChange={(e) => setNewAdminEmail(e.target.value)}
                            />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void inviteAdmin(f.id)}
                              className="sm:col-span-2 rounded-xl bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-800 disabled:opacity-50"
                            >
                              <i className="fa-solid fa-paper-plane mr-2 text-xs" aria-hidden />
                              Send secure invitation
                            </button>
                            <p className="sm:col-span-2 text-xs text-slate-500">
                              No temporary passwords shown here. The invitee receives a secure invitation link by email and
                              chooses their own password.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <input
                                className={inputCls}
                                type="email"
                                placeholder="Existing user email"
                                value={assignEmail}
                                onChange={(e) => setAssignEmail(e.target.value)}
                              />
                              <button
                                type="button"
                                onClick={() => void lookupUser()}
                                className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                              >
                                Look up
                              </button>
                            </div>
                            {lookup ? (
                              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                                <p className="font-medium text-slate-900">{lookup.fullName}</p>
                                <p className="text-xs text-slate-500">
                                  {lookup.role}
                                  {lookup.faculty ? ` · ${lookup.faculty.name}` : ''}
                                </p>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void assignAdmin(f.id)}
                                  className="mt-3 rounded-xl bg-primary-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                >
                                  Assign as faculty admin
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : expanded ? (
                    <p className="mt-4 text-sm text-slate-500">Loading details…</p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
