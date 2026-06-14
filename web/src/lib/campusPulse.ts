export type CampusPulseItem = {
  id: string;
  type: 'upload' | 'trending' | 'discussion' | 'contribution';
  actor: string;
  actorRole?: string;
  department?: string;
  courseCode?: string;
  message: string;
  at: string;
  rel: string;
};

export type CampusPulse = {
  items: CampusPulseItem[];
  stats: {
    onlineNow: number;
    uploadsToday: number;
    discussionsToday: number;
    refreshedAt: string;
  };
};
