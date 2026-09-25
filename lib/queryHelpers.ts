/** Escapes `%` and `_` so user input can't inject unintended ILIKE wildcards. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

/**
 * PostgREST's `.or()` filter string is comma-delimited, so any value containing
 * a comma (or other reserved characters) must be wrapped in double quotes.
 * See: https://postgrest.org/en/stable/references/api/tables_views.html#operators
 */
export function buildOrFilterValue(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

const LATIN_LETTER = /[A-Za-z]/;

/**
 * Builds a case-insensitive POSIX regex for `query` that refuses to match inside a
 * longer Latin word — so "AI" matches "AI가" or "(AI)" but not "said" or "Strait".
 * Only edges that are Latin letters get a boundary; Korean text is unaffected.
 * Returns null when neither edge is a Latin letter (plain ILIKE is enough then).
 */
export function buildLatinBoundaryRegex(query: string): string | null {
  const needsStart = LATIN_LETTER.test(query[0] ?? "");
  const needsEnd = LATIN_LETTER.test(query[query.length - 1] ?? "");
  if (!needsStart && !needsEnd) return null;

  const escaped = query.replace(/[\\^$.|?*+()[\]{}]/g, "\\$&");
  return `${needsStart ? "(^|[^A-Za-z])" : ""}${escaped}${needsEnd ? "([^A-Za-z]|$)" : ""}`;
}
