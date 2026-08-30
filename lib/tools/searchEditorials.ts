import { EDITORIAL_TABLE } from "../constants";
import {
  formatSearchResultsJson,
  formatSearchResultsMarkdown,
  ResponseFormat,
  toEditorialSummary,
} from "../format";
import { buildOrFilterValue, escapeIlikePattern } from "../queryHelpers";
import type { SearchEditorialsInput } from "../schemas/editorial";
import { getSupabaseClient } from "../services/supabase";
import type { EditorialRow } from "../types";

export async function searchEditorials(params: SearchEditorialsInput): Promise<string> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from(EDITORIAL_TABLE)
    .select("id, title, link, media, content, pubdate, published_at", { count: "exact" });

  if (params.query) {
    const pattern = buildOrFilterValue(`%${escapeIlikePattern(params.query)}%`);
    query = query.or(`title.ilike.${pattern},content.ilike.${pattern}`);
  }
  if (params.media) {
    query = query.eq("media", params.media);
  }
  if (params.date_from) {
    query = query.gte("published_at", `${params.date_from}T00:00:00+09:00`);
  }
  if (params.date_to) {
    query = query.lte("published_at", `${params.date_to}T23:59:59+09:00`);
  }

  query = query
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(params.offset, params.offset + params.limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return (
      `Error: Supabase query failed (${error.message}). ` +
      "Try narrowing your filters, or double-check the 'media' value with list_media_outlets."
    );
  }

  const rows = (data ?? []) as EditorialRow[];
  const summaries = rows.map(toEditorialSummary);
  const total = count ?? summaries.length;
  const hasMore = params.offset + summaries.length < total;

  return params.response_format === ResponseFormat.JSON
    ? formatSearchResultsJson(summaries, total, params.offset, hasMore)
    : formatSearchResultsMarkdown(summaries, total, params.offset, hasMore);
}
