import { EDITORIAL_TABLE, MAX_AGGREGATION_ROWS, SUPABASE_PAGE_SIZE } from "../constants";
import { formatMediaOutletsJson, formatMediaOutletsMarkdown, ResponseFormat } from "../format";
import type { ListMediaOutletsInput } from "../schemas/editorial";
import { getSupabaseClient } from "../services/supabase";
import type { MediaOutletCount } from "../types";

/**
 * The `editorial` table has no pre-aggregated media/count view, so this scans
 * the `media` column page by page (Postgrest caps rows per request) and tallies
 * counts in memory. With ~35 distinct outlets and ~22k rows this is a handful
 * of lightweight requests, capped by MAX_AGGREGATION_ROWS as a safety limit.
 */
export async function listMediaOutlets(params: ListMediaOutletsInput): Promise<string> {
  const supabase = getSupabaseClient();
  const counts = new Map<string, number>();
  let scanned = 0;
  let offset = 0;

  while (scanned < MAX_AGGREGATION_ROWS) {
    const { data, error } = await supabase
      .from(EDITORIAL_TABLE)
      .select("media")
      .range(offset, offset + SUPABASE_PAGE_SIZE - 1);

    if (error) {
      return `Error: Supabase query failed (${error.message}).`;
    }

    const rows = data ?? [];
    for (const row of rows as { media: string | null }[]) {
      const key = row.media ?? "(언론사 미상)";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    scanned += rows.length;
    offset += SUPABASE_PAGE_SIZE;

    if (rows.length < SUPABASE_PAGE_SIZE) break;
  }

  const outlets: MediaOutletCount[] = Array.from(counts.entries())
    .map(([media, count]) => ({ media, count }))
    .sort((a, b) => b.count - a.count);

  return params.response_format === ResponseFormat.JSON
    ? formatMediaOutletsJson(outlets, scanned)
    : formatMediaOutletsMarkdown(outlets, scanned);
}
