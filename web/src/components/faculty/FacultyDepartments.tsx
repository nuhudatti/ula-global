import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { FacultyDepartment, HodAssignCandidate } from '../../lib/faculty';
import { InvitationLinkPanel, type InvitationLinkResult } from '../InvitationLinkPanel';

const inputCls =
  'w-full rounded-xl border-0 bg-slate-50/90 py-2.5 px-3.5 text-sm text-slate-800 ring-1 ring-slate-200/90 focus:ring-2 focus:ring-[#0f4c81]/40';

type StatusBanner = {
  tone: 'success' | 'error' | 'info';
  message: string;
};

function StatusBannerView({ banner }: { banner: StatusBanner }) {
  const cls =
    banner.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : banner.tone === 'error'
        ? 'border-red-200 bg-red-50 text-red-900'
        : 'border-sky-200 bg-sky-50 text-sky-900';
  const icon =
    banner.tone === 'success' ? 'fa-circle-check' : banner.tone === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>
      <p className="inline-flex items-start gap-2">
        <i className={`fa-solid ${icon} mt-0.5 shrink-0`} aria-hidden />
        <span>{banner.message}</span>
      </p>
    </div>
  );
}

type AssignHodResponse = FacultyDepartment & {
  assignment?: {
    message: string;
    hod?: { id: string; fullName: string; email: string };
  };
};

export function FacultyDepartments({
  departments,
  loading,
  onRefreshDepartments,
  onRefreshLeaders,
  apiPath = (path: string) => path,
}: {
  departments: FacultyDepartment[];
  loading: boolean;
  onRefreshDepartments: () => Promise<void>;
  onRefreshLeaders?: () => Promise<void>;
  apiPath?: (path: string) => string;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [assignDept, setAssignDept] = useState<string | null>(null);
  const [hodUserId, setHodUserId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [assignBusyDeptId, setAssignBusyDeptId] = useState<string | null>(null);
  const [inviteBusyDeptId, setInviteBusyDeptId] = useState<string | null>(null);
  const [banner, setBanner] = useState<StatusBanner | null>(null);
  const [cardNotice, setCardNotice] = useState<Record<string, StatusBanner>>({});
  const [hodInvite, setHodInvite] = useState<InvitationLinkResult | null>(null);
  const [candidates, setCandidates] = useState<HodAssignCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  useEffect(() => {
    if (!assignDept) return;
    setCandidatesLoading(true);
    api<{ items: HodAssignCandidate[] }>(apiPath('/api/faculty/hod-candidates'))
      .then((res) => setCandidates(res.items))
      .catch(() => setCandidates([]))
      .finally(() => setCandidatesLoading(false));
  }, [assignDept, apiPath]);

  async function createDept() {
    if (!newName.trim()) return;
    setCreateBusy(true);
    setBanner(null);
    setHodInvite(null);
    try {
      const created = await api<{ id: string; name: string }>(apiPath('/api/faculty/departments'), {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName('');
      setShowAdd(false);
      setBanner({
        tone: 'success',
        message: `Department "${created.name}" was created. Assign or invite a Head of Department below.`,
      });
      await onRefreshDepartments();
    } catch (e) {
      setBanner({ tone: 'error', message: e instanceof Error ? e.message : 'Could not create department' });
    } finally {
      setCreateBusy(false);
    }
  }

  async function assignHod(deptId: string, deptName: string) {
    if (!hodUserId) return;
    setAssignBusyDeptId(deptId);
    setBanner(null);
    setHodInvite(null);
    try {
      const res = await api<AssignHodResponse>(apiPath(`/api/faculty/departments/${deptId}`), {
        method: 'PATCH',
        body: JSON.stringify({ hodUserId }),
      });
      const selected = candidates.find((c) => c.id === hodUserId);
      const message =
        res.assignment?.message ||
        `${res.hod?.fullName ?? selected?.fullName ?? 'Staff member'} is now Head of Department for ${deptName}.`;
      setAssignDept(null);
      setHodUserId('');
      setBanner({ tone: 'success', message });
      setCardNotice((prev) => ({ ...prev, [deptId]: { tone: 'success', message } }));
      await onRefreshDepartments();
      await onRefreshLeaders?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not assign Head of Department';
      setBanner({ tone: 'error', message });
      setCardNotice((prev) => ({ ...prev, [deptId]: { tone: 'error', message } }));
    } finally {
      setAssignBusyDeptId(null);
    }
  }

  async function inviteHod(deptId: string, deptName: string) {
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    setInviteBusyDeptId(deptId);
    setBanner(null);
    setHodInvite(null);
    try {
      const res = await api<InvitationLinkResult>(apiPath('/api/faculty/people/hod-invite'), {
        method: 'POST',
        body: JSON.stringify({
          departmentId: deptId,
          email: inviteEmail.trim(),
          fullName: inviteName.trim(),
        }),
      });
      const url = res.devActivationUrl || res.activationUrl || (res.inviteUrl ? `${window.location.origin}${res.inviteUrl}` : '');
      if (url) await navigator.clipboard.writeText(url);
      setHodInvite({
        fullName: inviteName.trim(),
        email: inviteEmail.trim(),
        inviteUrl: res.inviteUrl,
        activationUrl: res.activationUrl,
        devActivationUrl: res.devActivationUrl,
        emailSent: res.emailSent,
        emailError: res.emailError,
      });
      const message = res.emailSent
        ? `Invitation email sent to ${inviteEmail.trim()} for ${deptName}. Link copied to clipboard.`
        : `Invitation created for ${deptName}. Email may not have arrived — copy the link below.`;
      setBanner({ tone: res.emailSent ? 'success' : 'info', message });
      setCardNotice((prev) => ({ ...prev, [deptId]: { tone: res.emailSent ? 'success' : 'info', message } }));
      setInviteEmail('');
      setInviteName('');
      setAssignDept(null);
      await onRefreshDepartments();
      await onRefreshLeaders?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not send HOD invitation';
      setBanner({ tone: 'error', message });
      setCardNotice((prev) => ({ ...prev, [deptId]: { tone: 'error', message } }));
    } finally {
      setInviteBusyDeptId(null);
    }
  }

  async function removeDept(id: string, name: string) {
    if (!confirm(`Remove "${name}"? Only empty departments can be deleted.`)) return;
    setBanner(null);
    try {
      await api(apiPath(`/api/faculty/departments/${id}`), { method: 'DELETE' });
      setBanner({ tone: 'success', message: `Department "${name}" was removed.` });
      await onRefreshDepartments();
    } catch (e) {
      setBanner({ tone: 'error', message: e instanceof Error ? e.message : 'Could not remove department' });
    }
  }

  return (
    <div className="ula-dept-animate-in w-full max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f4c81]">Departments</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Manage your departments</h2>
          <p className="mt-2 max-w-lg text-sm text-slate-500">
            Create departments, assign an existing Head of Department, or invite someone new by email. Day-to-day
            lecturer management stays in each department workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAdd(true);
            setBanner(null);
          }}
          className="rounded-xl bg-[#0f4c81] px-5 py-2.5 text-sm font-semibold text-white"
        >
          <i className="fa-solid fa-plus mr-1.5 text-xs" aria-hidden />
          Add department
        </button>
      </header>

      {banner ? <StatusBannerView banner={banner} /> : null}

      {hodInvite ? (
        <InvitationLinkPanel
          {...hodInvite}
          roleLabel="Head of Department"
          onDismiss={() => setHodInvite(null)}
        />
      ) : null}

      {showAdd ? (
        <div className="ula-dept-surface space-y-4 p-6">
          <h3 className="font-semibold text-slate-900">New department</h3>
          <input
            className={inputCls}
            placeholder="Department name (e.g. Computer Science)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={createBusy || !newName.trim()}
              onClick={() => void createDept()}
              className="rounded-xl bg-[#0f4c81] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {createBusy ? 'Creating…' : 'Create department'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-xl px-4 py-2 text-sm text-slate-600">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading departments…</p>
      ) : departments.length === 0 ? (
        <div className="ula-dept-surface px-8 py-14 text-center">
          <h3 className="font-semibold text-slate-900">No departments yet</h3>
          <p className="mt-2 text-sm text-slate-500">Add your first department, then assign or invite a Head of Department.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {departments.map((d) => {
            const staffCount = d.staffCount ?? d.lecturerCount;
            const isAssigning = assignBusyDeptId === d.id;
            const isInviting = inviteBusyDeptId === d.id;
            const notice = cardNotice[d.id];
            return (
              <article key={d.id} className="ula-faculty-dept-card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{d.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {staffCount} staff · {d.courseCount} courses · {d.resourceCount} materials
                    </p>
                  </div>
                </div>

                {notice ? (
                  <div className="mt-3">
                    <StatusBannerView banner={notice} />
                  </div>
                ) : null}

                <div className="mt-4 rounded-xl bg-slate-50/80 px-3 py-2.5 text-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Head of Department</p>
                  {d.hod ? (
                    <div className="mt-1">
                      <p className="font-medium text-slate-800">{d.hod.fullName}</p>
                      <p className="text-xs text-slate-500">{d.hod.email}</p>
                    </div>
                  ) : d.pendingHodInvite ? (
                    <div className="mt-1">
                      <p className="font-medium text-amber-800">Invitation pending</p>
                      <p className="text-xs text-slate-600">
                        {d.pendingHodInvite.fullName} · {d.pendingHodInvite.email}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-slate-500">No HOD assigned yet</p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignDept(assignDept === d.id ? null : d.id);
                      setHodUserId('');
                      setInviteEmail('');
                      setInviteName('');
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0f4c81] ring-1 ring-[#0f4c81]/25"
                  >
                    {assignDept === d.id ? 'Close' : d.hod ? 'Change HOD' : 'Set HOD'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeDept(d.id, d.name)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200"
                  >
                    Remove
                  </button>
                </div>

                {assignDept === d.id ? (
                  <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Assign existing staff as HOD</label>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Choose any active lecturer or HOD in your institution. They will lead this department.
                      </p>
                      <select
                        className={`${inputCls} mt-2`}
                        value={hodUserId}
                        onChange={(e) => setHodUserId(e.target.value)}
                        disabled={candidatesLoading}
                      >
                        <option value="">
                          {candidatesLoading ? 'Loading staff…' : candidates.length ? 'Select staff member…' : 'No staff available yet'}
                        </option>
                        {candidates.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.fullName} — {p.department.name} ({p.role === 'HOD' ? 'HOD' : 'Lecturer'})
                          </option>
                        ))}
                      </select>
                      {!candidatesLoading && candidates.length === 0 ? (
                        <p className="mt-2 text-[11px] text-amber-700">
                          No active staff found. Use the invitation form below to invite a new Head of Department.
                        </p>
                      ) : null}
                      <button
                        type="button"
                        disabled={!hodUserId || isAssigning || isInviting}
                        onClick={() => void assignHod(d.id, d.name)}
                        className="mt-3 rounded-lg bg-[#0f4c81] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {isAssigning ? 'Assigning…' : `Assign as HOD of ${d.name}`}
                      </button>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                      <label className="text-xs font-semibold text-slate-600">Or invite a new Head of Department</label>
                      <p className="mt-1 text-[11px] text-slate-500">
                        They receive an email with a secure link to accept and set their password.
                      </p>
                      <input
                        className={`${inputCls} mt-2`}
                        placeholder="Full name"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                      />
                      <input
                        className={`${inputCls} mt-2`}
                        type="email"
                        placeholder="Institutional email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={isAssigning || isInviting || !inviteEmail.trim() || !inviteName.trim()}
                        onClick={() => void inviteHod(d.id, d.name)}
                        className="mt-3 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {isInviting ? 'Sending invitation…' : `Email HOD invitation for ${d.name}`}
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
