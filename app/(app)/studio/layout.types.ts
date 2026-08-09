export type VideoVisibility = "public" | "unlisted" | "private";

export type OwnerStream = {
  id: string;
  title: string;
  startedAt: string | null;
  durationS: number | null;
  thumbnailUrl: string | null;
  videoId: string | null;
  hasVod: boolean;
  hasTimeline: boolean;
  visibility: VideoVisibility | null;
};

export type StudioTool = {
  href: string;
  label: string;
};
