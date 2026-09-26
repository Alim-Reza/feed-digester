import type { Repositories } from '../db/repositories';
import type { DigestConfig } from '../config/schema';
import type { InsightLevel } from '../db/schema';
import type { JobMarketView } from '../services/jobs/aggregate';
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

export type TopicSourceView = {
  rank: number;
  authorName: string;
  url: string | null;
  /** The post's own stored headline (real data, never fabricated) — used as the source's one-line description on the insight-detail page (docs/ui-redesign-handoff.md §4/§5). */
  authorHeadline: string | null;
  /** A short excerpt of the post's own stored content, truncated for display — same rationale as `authorHeadline`. */
  excerpt: string | null;
};
export type TopicView = {
  id: string;
  rank: number;
  title: string;
  summary: string;
  whyItMatters: string | null;
  suggestedAction: string | null;
  noveltyLevel: InsightLevel | null;
  confidence: InsightLevel | null;
  sources: TopicSourceView[];
};
export type SectionView = {
  category: string;
  label: string;
  tldr: string;
  postCount: number;
  topics: TopicView[];
};
export type BriefingStats = {
  postsScanned: number;
  postsUseful: number;
  postsFilteredNoise: number;
  duplicatesMerged: number;
  estimatedReadingMinutes: number;
};
export type DigestDetailView = {
  id: string;
  windowStart: Date;
  windowEnd: Date;
  briefing: BriefingStats;
  sections: SectionView[];
  jobMarket: JobMarketView | null;
};

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

const SOURCE_EXCERPT_MAX_LENGTH = 160;

/** Truncates on a word boundary where possible, for the insight-detail sidebar's source excerpt. */
function truncateExcerpt(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (trimmed.length <= SOURCE_EXCERPT_MAX_LENGTH) return trimmed;
  const cut = trimmed.slice(0, SOURCE_EXCERPT_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Shapes one digest for `/digests/[id]`: sections in their stored display order, each with only
 * its *featured* insights — a cluster the `summarize` stage judged a real insight AND the
 * `digest` stage's deterministic cross-category ranking kept (`rank IS NOT NULL`, spec-second.md
 * §7's finite briefing, replacing the old per-section top-5 cap) — sorted by that global rank,
 * each with its synthesized claim plus the up-to-3 source posts it was built from (grill H4:
 * author names live in the source list, not the claim text; spec-second.md §9: no inline
 * `[1][2][3]` citations — sources are a structured list, not markers in the text).
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
    if (cluster.rank === null) continue; // not an insight, or cut for length (spec-second.md §7)
    if (!clustersByCategory.has(cluster.category)) clustersByCategory.set(cluster.category, []);
    clustersByCategory.get(cluster.category)!.push(cluster);
  }
  for (const list of clustersByCategory.values()) list.sort((a, b) => a.rank! - b.rank!);

  const sections: SectionView[] = repos.digestSections
    .listForDigest(digestId)
    .map((section) => {
      const clusters = clustersByCategory.get(section.category) ?? [];
      const topics: TopicView[] = clusters.map((cluster) => {
        const members = repos.topicClusterPosts.listForCluster(cluster.id).slice(0, MAX_SOURCES_PER_TOPIC);
        const sources: TopicSourceView[] = members.map((member, i) => {
          const post = repos.posts.get(member.postId);
          return {
            rank: i + 1,
            authorName: post?.authorName ?? 'Unknown',
            url: post?.url ?? null,
            authorHeadline: post?.authorHeadline ?? null,
            excerpt: post?.content ? truncateExcerpt(post.content) : null,
          };
        });
        return {
          id: cluster.id,
          rank: cluster.rank!,
          title: cluster.title,
          summary: cluster.summary,
          whyItMatters: cluster.whyItMatters,
          suggestedAction: cluster.suggestedAction,
          noveltyLevel: cluster.noveltyLevel,
          confidence: cluster.confidence,
          sources,
        };
      });
      const label = config.categories.find((c) => c.id === section.category)?.label ?? section.category;
      return { category: section.category, label, tldr: section.tldr, postCount: section.postCount, topics };
    })
    .filter((section) => section.topics.length > 0);
  sections.sort((a, b) => {
    const rankA = a.topics[0]?.rank ?? Number.MAX_SAFE_INTEGER;
    const rankB = b.topics[0]?.rank ?? Number.MAX_SAFE_INTEGER;
    return rankA - rankB;
  });

  const stats = digestRow.stats as {
    jobMarket?: JobMarketView;
    postsScanned?: unknown;
    postsUseful?: unknown;
    postsFilteredNoise?: unknown;
    duplicatesMerged?: unknown;
    estimatedReadingMinutes?: unknown;
  };
  return {
    id: digestRow.id,
    windowStart: digestRow.windowStart,
    windowEnd: digestRow.windowEnd,
    briefing: {
      postsScanned: asNumber(stats.postsScanned),
      postsUseful: asNumber(stats.postsUseful),
      postsFilteredNoise: asNumber(stats.postsFilteredNoise),
      duplicatesMerged: asNumber(stats.duplicatesMerged),
      estimatedReadingMinutes: asNumber(stats.estimatedReadingMinutes),
    },
    sections,
    jobMarket: stats.jobMarket ?? null,
  };
}

export type InsightDetailView = { topic: TopicView; categoryId: string; categoryLabel: string };

/**
 * Finds one insight (a `TopicView`) inside an already-fetched digest by its `topicClusters.id`
 * — the insight-detail page's data (docs/ui-redesign-handoff.md §3/§7 step 5). A small pure
 * lookup over `getDigestDetail`'s output rather than a new repository query, since the whole
 * digest is already the unit of caching/fetching everywhere else in this app.
 */
export function findInsight(digest: DigestDetailView, insightId: string): InsightDetailView | undefined {
  for (const section of digest.sections) {
    const topic = section.topics.find((t) => t.id === insightId);
    if (topic) return { topic, categoryId: section.category, categoryLabel: section.label };
  }
  return undefined;
}
