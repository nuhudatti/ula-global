/**
 * Single source of truth for resource-kind visuals — ribbon, badge, and icon stay in one hue family.
 * Icons use Font Awesome 6 solid (loaded in web/index.html).
 */

export type ResourceKindTheme = {
  /** Tailwind gradient classes after `bg-gradient-to-r` */
  ribbon: string;
  badge: string;
  iconBox: string;
  iconClass: string;
  glow: string;
  /** Past / Quiz uses blue archive tone — distinct from lecture “course” teal */
  chipIdle: string;
  chipHover: string;
};

export const RESOURCE_KIND_THEMES: Record<string, ResourceKindTheme> = {
  PAST_QUESTIONS: {
    ribbon: 'from-blue-700 via-blue-600 to-blue-500',
    badge: 'bg-blue-50 text-blue-900 ring-1 ring-blue-200',
    iconBox: 'bg-blue-100 text-blue-800',
    iconClass: 'fa-file-lines',
    glow: 'shadow-[0_14px_44px_-14px_rgba(37,99,235,0.38)]',
    chipIdle: 'border-blue-200 bg-blue-50/90 text-blue-950 hover:bg-blue-100',
    chipHover: 'border-blue-300 bg-blue-500 text-white hover:bg-blue-600',
  },
  LECTURE_NOTES: {
    ribbon: 'from-teal-700 via-teal-600 to-emerald-500',
    badge: 'bg-teal-50 text-teal-950 ring-1 ring-teal-200',
    iconBox: 'bg-teal-100 text-teal-800',
    iconClass: 'fa-book-open',
    glow: 'shadow-[0_14px_44px_-14px_rgba(13,148,136,0.32)]',
    chipIdle: 'border-teal-200 bg-teal-50/90 text-teal-950 hover:bg-teal-100',
    chipHover: 'border-teal-300 bg-teal-600 text-white hover:bg-teal-700',
  },
  HANDOUT: {
    ribbon: 'from-emerald-700 via-emerald-600 to-green-500',
    badge: 'bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200',
    iconBox: 'bg-emerald-100 text-emerald-900',
    iconClass: 'fa-scroll',
    glow: 'shadow-[0_14px_44px_-14px_rgba(16,185,129,0.28)]',
    chipIdle: 'border-emerald-200 bg-emerald-50/90 text-emerald-950 hover:bg-emerald-100',
    chipHover: 'border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700',
  },
  ASSIGNMENT: {
    ribbon: 'from-amber-600 via-orange-500 to-amber-500',
    badge: 'bg-amber-50 text-amber-950 ring-1 ring-amber-200',
    iconBox: 'bg-amber-100 text-amber-950',
    iconClass: 'fa-pen-to-square',
    glow: 'shadow-[0_14px_44px_-14px_rgba(245,158,11,0.35)]',
    chipIdle: 'border-amber-200 bg-amber-50/90 text-amber-950 hover:bg-amber-100',
    chipHover: 'border-amber-300 bg-amber-500 text-white hover:bg-amber-600',
  },
  PROJECT: {
    ribbon: 'from-violet-700 via-purple-600 to-fuchsia-500',
    badge: 'bg-violet-50 text-violet-950 ring-1 ring-violet-200',
    iconBox: 'bg-violet-100 text-violet-900',
    iconClass: 'fa-diagram-project',
    glow: 'shadow-[0_14px_44px_-14px_rgba(124,58,237,0.28)]',
    chipIdle: 'border-violet-200 bg-violet-50/90 text-violet-950 hover:bg-violet-100',
    chipHover: 'border-violet-300 bg-violet-600 text-white hover:bg-violet-700',
  },
  OTHER: {
    ribbon: 'from-slate-700 via-slate-600 to-slate-500',
    badge: 'bg-slate-50 text-slate-900 ring-1 ring-slate-200',
    iconBox: 'bg-slate-100 text-slate-800',
    iconClass: 'fa-file',
    glow: 'shadow-[0_14px_44px_-14px_rgba(15,23,42,0.12)]',
    chipIdle: 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100',
    chipHover: 'border-slate-400 bg-slate-700 text-white hover:bg-slate-800',
  },
};

export function themeForKind(kind: string): ResourceKindTheme {
  return RESOURCE_KIND_THEMES[kind] ?? RESOURCE_KIND_THEMES.OTHER;
}
