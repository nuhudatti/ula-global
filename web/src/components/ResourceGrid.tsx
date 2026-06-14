import { ResourceCard, type ResourceCardModel } from './ResourceCard';
import type { DownloadPhase } from '../lib/download';

type ResourceGridProps = {
  items: ResourceCardModel[];
  onDownload?: (
    id: string,
    fileName: string,
    onPhase?: (phase: DownloadPhase, progressPercent?: number) => void,
  ) => Promise<void>;
  onRated?: () => void;
};

export function ResourceGrid({ items, onDownload, onRated }: ResourceGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-x-6 md:gap-y-8 xl:grid-cols-3 xl:gap-x-8">
      {items.map((resource) => (
        <ResourceCard key={resource.id} r={resource} onDownload={onDownload} onRated={onRated} />
      ))}
    </div>
  );
}
