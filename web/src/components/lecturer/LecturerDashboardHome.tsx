import { Link } from 'react-router-dom';
import type { LecturerCourse, LecturerResource } from '../../lib/lecturer';
import { computeLecturerStats, greetingName, kindLabel } from '../../lib/lecturer';
import { IdentityAvatar } from '../IdentityAvatar';
import { resolveImageUrl } from '../../lib/mediaUrl';

type Props = {
  fullName: string;
  email?: string;
  departmentName?: string;
  profilePhotoUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  courses: LecturerCourse[];
  resources: LecturerResource[];
  onPublish: () => void;
  onAssignments: () => void;
  onLibrary: () => void;
  onEditIdentity?: () => void;
};

export function LecturerDashboardHome({
  fullName,
  email,
  departmentName,
  profilePhotoUrl,
  bannerUrl,
  bio,
  courses,
  resources,
  onPublish,
  onAssignments,
  onLibrary,
  onEditIdentity,
}: Props) {
  const stats = computeLecturerStats(resources, courses);
  const recent = resources.slice(0, 4);
  const bannerStyle = resolveImageUrl(bannerUrl)
    ? { backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.15), rgba(255,255,255,0.92)), url(${resolveImageUrl(bannerUrl)})` }
    : undefined;

  return (
    <div className="space-y-8 animate-in">
      <section className="ula-lecturer-surface relative overflow-hidden p-6 md:p-8 lg:p-10">
        {bannerStyle ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-cover bg-center opacity-90"
            style={bannerStyle}
            aria-hidden
          />
        ) : (
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-40" aria-hidden>
            <div className="h-full w-full bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(37,99,235,0.08),transparent_50%),radial-gradient(ellipse_60%_50%_at_100%_0%,rgba(21,128,61,0.1),transparent_55%)]" />
          </div>
        )}
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            <IdentityAvatar
              name={fullName}
              imageUrl={profilePhotoUrl}
              size="xl"
              priority
              className="!h-[5.5rem] !w-[5.5rem] ring-4 ring-white shadow-[0_8px_30px_-8px_rgba(15,23,42,0.2)]"
            />
            {onEditIdentity ? (
              <button
                type="button"
                onClick={onEditIdentity}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary-800 text-white shadow-md transition hover:bg-primary-900"
                aria-label="Update profile photo"
                title="Update photo"
              >
                <i className="fa-solid fa-camera text-[11px]" aria-hidden />
              </button>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-dark-500">Welcome back,</p>
            <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight text-dark-900 md:text-[2.25rem]">
              {greetingName(fullName)}
            </h1>
            {email ? <p className="mt-1 text-[13px] text-dark-400">{email}</p> : null}
            {departmentName ? (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[15px] text-dark-600">
                <i className="fa-solid fa-building-columns text-[13px] text-primary-600" aria-hidden />
                {departmentName}
              </p>
            ) : null}
            {bio ? <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-dark-600">{bio}</p> : null}
          </div>
        </div>
        <p className="mt-4 text-[14px] tabular-nums text-dark-500">
          <span className="font-semibold text-dark-800">{stats.activeCourses}</span> active courses ·{' '}
          <span className="font-semibold text-dark-800">{stats.totalResources}</span> resources ·{' '}
          <span className="font-semibold text-dark-800">{stats.totalDownloads.toLocaleString()}</span> student
          accesses
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onPublish}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-800 px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:bg-primary-900"
          >
            <i className="fa-solid fa-plus text-[13px]" aria-hidden />
            Publish material
          </button>
          <button
            type="button"
            onClick={onAssignments}
            className="inline-flex items-center gap-2 rounded-xl border border-dark-200 bg-white px-5 py-2.5 text-[14px] font-medium text-dark-700 hover:bg-dark-50"
          >
            <i className="fa-solid fa-clipboard-list text-[13px]" aria-hidden />
            Assignments
          </button>
          <button
            type="button"
            onClick={onLibrary}
            className="inline-flex items-center gap-2 rounded-xl border border-dark-200 bg-white px-5 py-2.5 text-[14px] font-medium text-dark-700 hover:bg-dark-50"
          >
            My materials
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-dark-200/80 px-5 py-2.5 text-[14px] font-medium text-dark-600 hover:bg-dark-50"
          >
            <i className="fa-solid fa-globe text-[13px]" aria-hidden />
            Public catalogue
          </Link>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Resources published', value: stats.totalResources, icon: 'fa-layer-group' },
          { label: 'Student downloads', value: stats.totalDownloads, icon: 'fa-arrow-down' },
          { label: 'Active courses', value: stats.activeCourses, icon: 'fa-book' },
          {
            label: 'Avg. rating',
            value: stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—',
            icon: 'fa-star',
          },
        ].map((s) => (
          <div key={s.label} className="ula-lecturer-stat">
            <i className={`fa-solid ${s.icon} mb-3 text-[14px] text-primary-600`} aria-hidden />
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-dark-900">
              {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
            </p>
            <p className="mt-1 text-[12px] font-medium text-dark-500">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="ula-lecturer-surface p-6 md:p-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-dark-900">Recent publications</h2>
            <p className="mt-1 text-[13px] text-dark-500">Your latest contributions to the archive</p>
          </div>
          <button
            type="button"
            onClick={onLibrary}
            className="text-[13px] font-medium text-primary-700 hover:text-primary-800"
          >
            View all
          </button>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-dark-200/80 py-14 text-center">
            <p className="text-[15px] font-medium text-dark-700">No publications yet</p>
            <p className="mt-2 text-[13px] text-dark-500">Publish your first resource to begin building impact.</p>
            <button
              type="button"
              onClick={onPublish}
              className="mt-6 rounded-xl bg-primary-800 px-5 py-2.5 text-[14px] font-semibold text-white"
            >
              Start publishing
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-dark-100/90">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium text-dark-900">{r.title}</p>
                  <p className="text-[13px] text-dark-500">
                    {r.course.code} · {kindLabel(r.kind)} ·{' '}
                    {new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </p>
                </div>
                <span className="text-[13px] tabular-nums text-dark-500">{r.downloadCount} downloads</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
