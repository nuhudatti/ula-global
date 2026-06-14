/** Institutional admin — faculty scope in /admin only (not faculty workspace). */

export function adminFacultyUrl(facultyId: string): string {
  return `/admin?facultyId=${encodeURIComponent(facultyId)}`;
}
