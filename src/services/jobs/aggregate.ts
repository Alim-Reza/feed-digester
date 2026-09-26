import type { JobOpeningRow } from '../../db/repositories/jobOpenings';

export type JobMarketStats = {
  totalOpenings: number;
  companies: { name: string; count: number }[];
  roles: { name: string; count: number }[];
  skills: { name: string; count: number }[];
  seniorities: { name: string; count: number }[];
  locations: { name: string; count: number }[];
};

function countBy(values: (string | null)[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** Spec's Job Market section: companies hiring, roles, most requested skills, seniority, location/remote patterns — current digest window only (grill G6). */
export function aggregateJobMarket(rows: readonly JobOpeningRow[]): JobMarketStats {
  return {
    totalOpenings: rows.length,
    companies: countBy(rows.map((r) => r.company)),
    roles: countBy(rows.map((r) => r.role)),
    skills: countBy(rows.flatMap((r) => r.skills)),
    seniorities: countBy(rows.map((r) => r.seniority)),
    locations: countBy(rows.map((r) => r.location)),
  };
}

export type JobOpeningView = {
  postId: string;
  company: string | null;
  role: string;
  location: string | null;
  remoteStatus: string | null;
  seniority: string | null;
  skills: string[];
  url: string | null;
  authorName: string;
  whyRelevant: string | null;
  skillGaps: string[];
};

export type JobMarketView = JobMarketStats & { openings: JobOpeningView[] };

function computeWhyRelevant(role: string, skills: readonly string[], keywords: readonly string[]): string | null {
  if (keywords.length === 0) return null;
  const haystack = `${role} ${skills.join(' ')}`.toLowerCase();
  const matched = keywords.find((k) => k.trim() !== '' && haystack.includes(k.trim().toLowerCase()));
  return matched ? `Matches your interest in "${matched}"` : null;
}

function computeSkillGaps(skills: readonly string[], alreadyFamiliarWith: readonly string[]): string[] {
  if (alreadyFamiliarWith.length === 0) return [];
  const known = new Set(alreadyFamiliarWith.map((s) => s.trim().toLowerCase()));
  return skills.filter((s) => !known.has(s.trim().toLowerCase()));
}

/**
 * Structured per-opening view (spec-second.md §8): URL/author come from a join against `posts`
 * (no schema change — both already existed there); "why relevant"/"skill gaps" are deterministic
 * profile-keyword heuristics, not a new LLM call, per the spec's own "Potentially also" hedge and
 * CLAUDE.md's "minimize unnecessary inference." Stays silent (`null`/`[]`) rather than guessing
 * when the reader profile is empty — the default, until someone fills it in (grill part 2/3 Q3).
 */
export function buildJobOpeningViews(
  rows: readonly JobOpeningRow[],
  sourceByPostId: ReadonlyMap<string, { url: string | null; authorName: string }>,
  profile: { interests: string[]; goals: string[]; alreadyFamiliarWith: string[] },
): JobOpeningView[] {
  const keywords = [...profile.interests, ...profile.goals];
  return rows.map((r) => {
    const source = sourceByPostId.get(r.postId);
    return {
      postId: r.postId,
      company: r.company,
      role: r.role,
      location: r.location,
      remoteStatus: r.remoteStatus,
      seniority: r.seniority,
      skills: r.skills,
      url: source?.url ?? null,
      authorName: source?.authorName ?? 'Unknown',
      whyRelevant: computeWhyRelevant(r.role, r.skills, keywords),
      skillGaps: computeSkillGaps(r.skills, profile.alreadyFamiliarWith),
    };
  });
}
