import { EDITORIAL_TABLE } from "../constants";
import { formatEditorialDetailJson, formatEditorialDetailMarkdown, ResponseFormat, toEditorialDetail } from "../format";
import type { GetEditorialInput } from "../schemas/editorial";
import { getSupabaseClient } from "../services/supabase";
import type { EditorialRow } from "../types";

export async function getEditorial(params: GetEditorialInput): Promise<string> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from(EDITORIAL_TABLE)
    .select("id, title, link, media, content, pubdate, published_at");

  query = params.id !== undefined ? query.eq("id", params.id) : query.eq("link", params.link as string);

  const { data, error } = await query.maybeSingle();

  if (error) {
    return `Error: Supabase query failed (${error.message}).`;
  }

  if (!data) {
    const identifier = params.id !== undefined ? `id=${params.id}` : `link=${params.link}`;
    return `No editorial found for ${identifier}. Use search_editorials to find a valid id or link first.`;
  }

  const detail = toEditorialDetail(data as EditorialRow);

  return params.response_format === ResponseFormat.JSON
    ? formatEditorialDetailJson(detail)
    : formatEditorialDetailMarkdown(detail);
}
