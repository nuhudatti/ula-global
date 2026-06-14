import { Link } from 'react-router-dom';

export function InstitutionNotFoundPage({ slug }: { slug: string }) {
  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <i className="fa-solid fa-building-circle-xmark text-xl" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold text-slate-900">Institution not found</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        No university workspace exists for <strong className="font-medium text-slate-700">{slug}</strong>.
        Check the slug spelling or ask your institution administrator for the correct link.
      </p>
      <Link
        to="/"
        className="btn-ula-primary mt-8 inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm"
      >
        Find your university
      </Link>
    </div>
  );
}
