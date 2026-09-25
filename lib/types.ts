/** Row shape of `public.editorial`, restricted to the columns this server reads. */
export interface EditorialRow {
  id: number;
  title: string | null;
  link: string | null;
  media: string | null;
  content: string | null;
  pubdate: string | null;
  published_at: string | null;
}

/** Where a search keyword was found; title matches rank above body-only matches. */
export type MatchLocation = "title" | "body";

export interface EditorialSummary {
  id: number;
  title: string;
  media: string;
  published_at: string | null;
  link: string | null;
  snippet: string;
  /** Present only when the search had a keyword. */
  matched_in?: MatchLocation;
}

export interface EditorialDetail {
  id: number;
  title: string;
  media: string;
  published_at: string | null;
  link: string | null;
  content: string;
  truncated: boolean;
}

export interface MediaOutletCount {
  media: string;
  count: number;
}
