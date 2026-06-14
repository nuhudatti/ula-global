import { IdentityAvatar } from './IdentityAvatar';

type MetaInfoRowProps = {
  department: string;
  level: number | null;
  lecturerName: string;
  lecturerPhotoUrl?: string | null;
  contributorName?: string | null;
};

export function MetaInfoRow({ department, level, lecturerName, lecturerPhotoUrl, contributorName }: MetaInfoRowProps) {
  const levelPart = level != null ? `Level ${level}` : null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[13px] text-dark-600">
      <span className="inline-flex items-center gap-1.5">
        <i className="fa-solid fa-building-columns text-[12px] text-dark-400" aria-hidden />
        {department}
      </span>
      {levelPart ? (
        <span className="inline-flex items-center gap-1.5">
          <i className="fa-solid fa-layer-group text-[12px] text-dark-400" aria-hidden />
          {levelPart}
        </span>
      ) : null}
      <span className="inline-flex items-center gap-1.5">
        <IdentityAvatar name={lecturerName} imageUrl={lecturerPhotoUrl} size="sm" className="!h-5 !w-5 !text-[9px]" />
        {lecturerName}
      </span>
      {contributorName ? (
        <span className="inline-flex items-center gap-1.5 text-dark-500">
          <i className="fa-solid fa-puzzle-piece text-[12px] text-dark-400" aria-hidden />
          Compilation: {contributorName}
        </span>
      ) : null}
    </div>
  );
}
