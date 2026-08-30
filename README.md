# gqai-editorial-mcp-server

Remote MCP server exposing **read-only** access to the `editorial` (사설) table
in the GQAI Supabase project (`20250320-exnews-supabase`, ~22k Korean newspaper
editorials from 35 outlets).

## Tools

- `search_editorials` — keyword + media outlet + date-range search, paginated
- `get_editorial` — full text of one editorial by `id` or `link`
- `list_media_outlets` — every outlet name and its editorial count

## Why it's safe to expose

- The `editorial` table's only RLS policy (`editorial_public_select`) grants
  `SELECT` to `anon`/`authenticated` — the app can never write, even if the
  code tried to.
- The server itself is gated by a static bearer token (`MCP_API_KEY`); no
  Authorization header (or the wrong token) gets a `401`.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in SUPABASE_ANON_KEY and MCP_API_KEY
npm run dev
```

The MCP endpoint is `http://localhost:3000/api/mcp` (Streamable HTTP,
JSON-RPC 2.0). Test it with:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Deploying to Vercel

```bash
vercel link
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add MCP_API_KEY
vercel deploy --prod
```

## Connecting a client

Any MCP client that supports Streamable HTTP:

```json
{
  "mcpServers": {
    "editorial": {
      "url": "https://<your-deployment>.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer <MCP_API_KEY>" }
    }
  }
}
```

For stdio-only clients, bridge with
[`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "editorial": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://<your-deployment>.vercel.app/api/mcp",
        "--header", "Authorization: Bearer <MCP_API_KEY>"
      ]
    }
  }
}
```

## Notes on the underlying data

- `title`/`content` have `pg_trgm` GIN indexes (`editorial_title_trgm_idx`,
  `editorial_content_trgm_idx`) added specifically to make `ILIKE` search fast
  enough to stay under Postgres' statement timeout — without them,
  `search_editorials` times out on the ~22k-row table.
- `published_at` is used as the canonical date for filtering/sorting (falls
  back to `pubdate` for display if null, though in practice both are always
  populated).
