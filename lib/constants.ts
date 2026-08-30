/** Maximum characters returned in a single tool response before truncation kicks in. */
export const CHARACTER_LIMIT = 25_000;

/** Default / max page size for search results. */
export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 100;

/** Length of the content snippet shown in search results (full text requires get_editorial). */
export const SNIPPET_LENGTH = 220;

/** Postgrest's per-request row cap; used to page through the table for aggregation. */
export const SUPABASE_PAGE_SIZE = 1000;

/** Safety cap on how many rows list_media_outlets will scan before giving up. */
export const MAX_AGGREGATION_ROWS = 100_000;

export const EDITORIAL_TABLE = "editorial";

export const KST_TIME_ZONE = "Asia/Seoul";
