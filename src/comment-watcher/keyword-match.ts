/**
 * Keyword detector. Returns true if the comment text mentions the CTA keyword.
 *
 * Match rules (from Allen's spec):
 *   - case-insensitive
 *   - whole word (avoid "CORPUS" matching "corpuscle")
 *   - the keyword can appear anywhere in the comment ("CORPUS please" / "yes CORPUS")
 *   - punctuation around the keyword is fine
 */
export function matchesKeyword(commentText: string, keyword: string): boolean {
  if (!keyword) return false;
  const normalized = keyword.replace(/[^A-Za-z0-9_]/g, "");
  if (!normalized) return false;
  const re = new RegExp(`(?:^|[^A-Za-z0-9_])${normalized}(?:[^A-Za-z0-9_]|$)`, "i");
  return re.test(commentText);
}
