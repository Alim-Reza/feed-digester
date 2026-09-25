/** grill G4: normalize through a case-insensitive alias dictionary ("k8s" -> "Kubernetes"); unknown skills pass through as written. */
export function normalizeSkills(skills: string[], aliases: Record<string, string>): string[] {
  const byLowerKey = new Map(Object.entries(aliases).map(([key, value]) => [key.toLowerCase(), value]));
  return skills
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 0)
    .map((skill) => byLowerKey.get(skill.toLowerCase()) ?? skill);
}
