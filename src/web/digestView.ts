import type { Repositories } from '../db/repositories';
import type { DigestConfig } from '../config/schema';
import type { JobMarketStats } from '../services/jobs/aggregate';
import { MAX_SOURCES_PER_TOPIC } from '../pipeline/stages/digestLimits';

export type DigestListItem = {
  id: string;
  windowStart: Date;
  windowEnd: Date;
  createdAt: Date;
  totalPosts: number;
};

/** Shapes `digests` rows for the `/digests` list — newest first (grill H6: browsable historically). */
export function listDigests(repos: Repositories): DigestListItem[] {
  return repos.digests.list().map((d) => ({
    id: d.id,
    windowStart: d.windowStart,
    windowEnd: d.windowEnd,
    createdAt: d.createdAt,
    totalPosts: typeof d.stats.totalPosts === 'number' ? d.stats.totalPosts : 0,
  }));
}

export type TopicSourceView = { rank: number; authorName: string; url: string | null };
export type TopicView = {
  id: string;
  title: string;
  bullets: { text: string; sources: number[] }[];
  sources: TopicSourceView[];
};
export type SectionView = {
  category: string;
  label: string;
  tldr: string;
  postCount: number;
  topics: TopicView[];
};
export type DigestDetailView = {
  id: string;
  windowStart: Date;
  windowEnd: Date;
  sections: SectionView[];
  jobMarket: JobMarketStats | null;
};

/**
 * Shapes one digest for `/digests/[id]`: sections in their stored display order, each with only
 * its *featured* topics (a cluster the `summarize` stage actually wrote a title for — grill A3
 * caps this at 5 per section already, so nothing here re-caps), each topic's bullets (already
 * cited `[1][2]` inline) plus the up-to-3 source posts those numbers refer to (grill H4: author
 * names live in the source list, not the summary text).
 */
export function getDigestDetail(
  repos: Repositories,
  config: DigestConfig,
  digestId: string,
): DigestDetailView | undefined {
  const digestRow = repos.digests.get(digestId);
  if (!digestRow) return undefined;

  const allClusters = repos.topicClusters.listForDigest(digestId);
  const clustersByCategory = new Map<string, (typeof allClusters)[number][]>();
  for (const cluster of allClusters) {
    if (cluster.title === '') continue; // unfeatured — grill A3's cap
    if (!clustersByCategory.has(cluster.category)) clustersByCategory.set(cluster.category, []);
    clustersByCategory.get(cluster.category)!.push(cluster);
  }

  const sections: SectionView[] = repos.digestSections.listForDigest(digestId).map((section) => {
    const clusters = clustersByCategory.get(section.category) ?? [];
    const topics: TopicView[] = clusters.map((cluster) => {
      const members = repos.topicClusterPosts.listForCluster(cluster.id).slice(0, MAX_SOURCES_PER_TOPIC);
      const sources: TopicSourceView[] = members.map((member, i) => {
        const post = repos.posts.get(member.postId);
        return { rank: i + 1, authorName: post?.authorName ?? 'Unknown', url: post?.url ?? null };
      });
      return { id: cluster.id, title: cluster.title, bullets: cluster.summary.bullets, sources };
    });
    const label = config.categories.find((c) => c.id === section.category)?.label ?? section.category;
    return { category: section.category, label, tldr: section.tldr, postCount: section.postCount, topics };
  });

  const stats = digestRow.stats as { jobMarket?: JobMarketStats };
  return {
    id: digestRow.id,
    windowStart: digestRow.windowStart,
    windowEnd: digestRow.windowEnd,
    sections,
    jobMarket: stats.jobMarket ?? null,
  };
}
