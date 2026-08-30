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
