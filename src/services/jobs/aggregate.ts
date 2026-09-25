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
