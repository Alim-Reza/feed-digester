export type SourcePost = {
  authorName: string;
  content: string;
  url: string | null;
};

export type ClusterSummary = {
  title: string;
  bullets: { text: string; sources: number[] }[];
};
