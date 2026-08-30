import { createMcpHandler, withMcpAuth } from "mcp-handler";
import {
  GetEditorialInputSchema,
  ListMediaOutletsInputSchema,
  SearchEditorialsInputSchema,
} from "@/lib/schemas/editorial";
import { getEditorial } from "@/lib/tools/getEditorial";
import { listMediaOutlets } from "@/lib/tools/listMediaOutlets";
import { searchEditorials } from "@/lib/tools/searchEditorials";

const baseHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_editorials",
      {
        title: "Search Editorials",
        description: `Search Korean newspaper editorials (사설) by keyword, media outlet, and/or publish date range.

This searches across all ~22,000 editorials collected from major Korean media outlets. It does NOT return full article text in the list view — each result includes a short snippet; use get_editorial with the returned id to fetch the full body.

Args:
  - query (string, optional): substring to match in title or body text
  - media (string, optional): exact media outlet name, e.g. "조선일보" (see list_media_outlets for valid values)
  - date_from / date_to (string, optional): YYYY-MM-DD, inclusive, filters on publish date (KST)
  - limit (number): 1-100, default 20
  - offset (number): pagination offset, default 0
  - response_format ('markdown' | 'json'): default 'markdown'

Returns: a ranked-by-date list of matching editorials (title, media, date, link, snippet), newest first.

Examples:
  - "Find 조선일보 editorials about 최저임금 in 2025" -> query="최저임금", media="조선일보", date_from="2025-01-01", date_to="2025-12-31"
  - "What editorials came out today about the election" -> query="선거", date_from=today, date_to=today

Error Handling:
  - Returns a natural-language message (not an exception) when the query fails or nothing matches, with a suggestion for how to adjust filters.`,
        inputSchema: SearchEditorialsInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (params) => ({
        content: [{ type: "text", text: await searchEditorials(params) }],
      }),
    );

    server.registerTool(
      "get_editorial",
      {
        title: "Get Editorial",
        description: `Fetch the full text of a single editorial by id or original article URL.

Use this after search_editorials to read the complete body of a specific editorial (search results only include a short snippet).

Args:
  - id (number, optional): the editorial's numeric id, from search_editorials results
  - link (string, optional): the editorial's original article URL, as an alternative to id
  - response_format ('markdown' | 'json'): default 'markdown'
  - Exactly one of id/link should be provided (id takes precedence if both are given)

Returns: title, media outlet, publish date, original link, and full body text. Very long bodies (>25,000 characters) are truncated with a note.

Error Handling:
  - Returns "No editorial found for ..." if the id/link doesn't match any row — double check the value came from search_editorials.`,
        inputSchema: GetEditorialInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (params) => ({
        content: [{ type: "text", text: await getEditorial(params) }],
      }),
    );

    server.registerTool(
      "list_media_outlets",
      {
        title: "List Media Outlets",
        description: `List every media outlet present in the editorial database, with how many editorials each has.

Use this to discover valid values for the 'media' filter on search_editorials, or to get a quick sense of source coverage.

Args:
  - response_format ('markdown' | 'json'): default 'markdown'

Returns: outlets sorted by editorial count, descending, plus the total number of editorials scanned.`,
        inputSchema: ListMediaOutletsInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (params) => ({
        content: [{ type: "text", text: await listMediaOutlets(params) }],
      }),
    );
  },
  {
    serverInfo: { name: "gqai-editorial-mcp-server", version: "0.1.0" },
  },
);

/**
 * Static bearer-token gate. This is an internal team tool, not a public
 * integration, so a single shared secret (MCP_API_KEY) is enough — no need
 * for a full OAuth authorization server. The server fails closed if the env
 * var isn't configured.
 */
const handler = withMcpAuth(
  baseHandler,
  async (_req, bearerToken) => {
    const expected = process.env.MCP_API_KEY;
    if (!expected || !bearerToken || bearerToken !== expected) {
      return undefined;
    }
    return { token: bearerToken, clientId: "gqai-team", scopes: [] };
  },
  { required: true },
);

export { handler as GET, handler as POST };
