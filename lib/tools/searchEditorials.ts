import { EDITORIAL_TABLE } from "../constants";
import {
  formatSearchResultsJson,
  formatSearchResultsMarkdown,
  ResponseFormat,
  toEditorialSummary,
} from "../format";
import { buildLatinBoundaryRegex, buildOrFilterValue, escapeIlikePattern } from "../queryHelpers";
import type { SearchEditorialsInput } from "../schemas/editorial";
import { getSupabaseClient } from "../services/supabase";
import type { EditorialRow, EditorialSummary, MatchLocation } from "../types";

const COLUMNS = "id, title, link, media, content, pubdate, published_at";

type Supabase = ReturnType<typeof getSupabaseClient>;
type TextFilter = { operator: "ilike" | "imatch"; pattern: string };

function buildTextFilter(query: string): TextFilter {
  const regex = buildLatinBoundaryRegex(query);
  return regex
    ? { operator: "imatch", pattern: regex }
    : { operator: "ilike", pattern: `%${escapeIlikePattern(query)}%` };
}

/**
 * Starts a select on the editorial table with the media/date filters applied.
 * `head: true` returns only the count, for sizing a result group without fetching rows.
 */
function baseQuery(supabase: Supabase, params: SearchEditorialsInput, head = false) {
  let query = supabase.from(EDITORIAL_TABLE).select(COLUMNS, { count: "exact", head });
  if (params.media) {
    query = query.eq("media", params.media);
  }
  if (params.date_from) {
    query = query.gte("published_at", `${params.date_from}T00:00:00+09:00`);
  }
  if (params.date_to) {
    query = query.lte("published_at", `${params.date_to}T23:59:59+09:00`);
  }
  return query;
}

function titleGroup(supabase: Supabase, params: SearchEditorialsInput, filter: TextFilter, head = false) {
  return baseQuery(supabase, params, head).filter("title", filter.operator, filter.pattern);
}

/** Editorials whose body matches but whose title does not — the second-tier group. */
function bodyOnlyGroup(supabase: Supabase, params: SearchEditorialsInput, filter: TextFilter, head = false) {
  const value = buildOrFilterValue(filter.pattern);
  return baseQuery(supabase, params, head)
    .filter("content", filter.operator, filter.pattern)
    .or(`title.is.null,title.not.${filter.operator}.${value}`);
}

function newestFirst<Q extends { order: (column: string, options: object) => Q }>(query: Q): Q {
  return query.order("published_at", { ascending: false, nullsFirst: false });
}

type SearchPage = { summaries: EditorialSummary[]; total: number };

function toSummaries(rows: unknown, matchedIn?: MatchLocation): EditorialSummary[] {
  return ((rows ?? []) as EditorialRow[]).map((row) => ({
    ...toEditorialSummary(row),
    ...(matchedIn && { matched_in: matchedIn }),
  }));
}

/** No keyword, or a title-only keyword: one query, newest first. */
async function searchSingleGroup(supabase: Supabase, params: SearchEditorialsInput): Promise<SearchPage> {
  let query = baseQuery(supabase, params);
  if (params.query) {
    const filter = buildTextFilter(params.query);
    query = query.filter("title", filter.operator, filter.pattern);
  }
  const { data, error, count } = await newestFirst(query).range(
    params.offset,
    params.offset + params.limit - 1,
  );
  if (error) throw error;
  const summaries = toSummaries(data, params.query ? "title" : undefined);
  return { summaries, total: count ?? summaries.length };
}

/**
 * Keyword over title and body: title matches rank above body-only matches, each group
 * newest first. The page [offset, offset + limit) is cut from the title group first and
 * filled from the body-only group, so pagination stays stable across both.
 */
async function searchRanked(supabase: Supabase, params: SearchEditorialsInput, keyword: string): Promise<SearchPage> {
  const filter = buildTextFilter(keyword);

  const [titleCount, bodyCount] = await Promise.all([
    titleGroup(supabase, params, filter, true),
    bodyOnlyGroup(supabase, params, filter, true),
  ]);
  if (titleCount.error) throw titleCount.error;
  if (bodyCount.error) throw bodyCount.error;
  const titleTotal = titleCount.count ?? 0;
  const total = titleTotal + (bodyCount.count ?? 0);

  // Split the requested window across the two groups, in group-local row indexes.
  const pageEnd = params.offset + params.limit;
  const titleEnd = Math.min(pageEnd, titleTotal);
  const bodyStart = Math.max(0, params.offset - titleTotal);
  const bodyEnd = Math.min(Math.max(0, pageEnd - titleTotal), total - titleTotal);

  const [titleRows, bodyRows] = await Promise.all([
    params.offset < titleEnd
      ? newestFirst(titleGroup(supabase, params, filter)).range(params.offset, titleEnd - 1)
      : null,
    bodyStart < bodyEnd
      ? newestFirst(bodyOnlyGroup(supabase, params, filter)).range(bodyStart, bodyEnd - 1)
      : null,
  ]);
  if (titleRows?.error) throw titleRows.error;
  if (bodyRows?.error) throw bodyRows.error;

  return {
    summaries: [...toSummaries(titleRows?.data, "title"), ...toSummaries(bodyRows?.data, "body")],
    total,
  };
}

export async function searchEditorials(params: SearchEditorialsInput): Promise<string> {
  const supabase = getSupabaseClient();

  let page: SearchPage;
  try {
    page =
      params.query && !params.title_only
        ? await searchRanked(supabase, params, params.query)
        : await searchSingleGroup(supabase, params);
  } catch (error) {
    const message = error instanceof Error ? error.message : (error as { message?: string }).message;
    return (
      `Error: Supabase query failed (${message ?? String(error)}). ` +
      "Try narrowing your filters, or double-check the 'media' value with list_media_outlets."
    );
  }

  const { summaries, total } = page;
  const hasMore = params.offset + summaries.length < total;

  return params.response_format === ResponseFormat.JSON
    ? formatSearchResultsJson(summaries, total, params.offset, hasMore)
    : formatSearchResultsMarkdown(summaries, total, params.offset, hasMore);
}
