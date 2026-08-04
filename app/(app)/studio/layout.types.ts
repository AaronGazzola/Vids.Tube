export type OwnerStream = {
  id: string;
  title: string;
  startedAt: string | null;
  durationS: number | null;
  thumbnailUrl: string | null;
  videoId: string | null;
  hasVod: boolean;
  hasTimeline: boolean;
};

export type StudioTool = {
  href: string;
  label: string;
};
