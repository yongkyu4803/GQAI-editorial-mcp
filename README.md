# gqai-editorial-mcp-server

Remote MCP server exposing **read-only** access to the `editorial` (사설) table
in the GQAI Supabase project (`20250320-exnews-supabase`, 23k+ Korean newspaper
editorials from 35 outlets).

## Live deployment

- **Endpoint**: `https://gqai-editorial-mcp.vercel.app/api/mcp`
- Hosted on Vercel; every push to `main` deploys automatically.

## Quick install

No auth needed — just point your client at the live endpoint.

**Claude Code:**

```bash
claude mcp add --transport http editorial https://gqai-editorial-mcp.vercel.app/api/mcp
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "editorial": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://gqai-editorial-mcp.vercel.app/api/mcp"]
    }
  }
}
```

**Any other Streamable HTTP-capable client:** add
`https://gqai-editorial-mcp.vercel.app/api/mcp` as the server URL — see
[Connecting a client](#connecting-a-client) below for the raw config format.

## Tools

Every tool takes `response_format`: `markdown` (default) or `json`.

### `search_editorials`

Find editorials by keyword, outlet, and date range. Returns summaries, not full
text — use `get_editorial` for the body.

| Input | Description |
|---|---|
| `query` | Keyword (2–200 chars), matched against title and body |
| `title_only` | `true` to match the title only — best for topic searches such as "AI", where many editorials mention the keyword in passing. Default `false` |
| `media` | Exact outlet name, e.g. `조선일보` (see `list_media_outlets`) |
| `date_from` / `date_to` | `YYYY-MM-DD`, inclusive, KST |
| `limit` / `offset` | Page size 1–100 (default 20) and offset |

Each result has `id`, `title`, `media`, `published_at`, `link`, a 220-character
`snippet`, and — when there is a `query` — `matched_in` (`title` or `body`). The
response also carries `total`, `has_more`, and `next_offset`.

How matching works:

- **Ranking.** With a `query`, editorials whose title matches come first, then
  those matching only in the body; each group is newest first. Without a
  `query` (or with `title_only`), everything is newest first.
- **Case-insensitive substring match**, except that an English edge of the
  keyword never matches inside a longer English word: `AI` matches `AI가`,
  `(AI)`, and `AI속도조절`, but not `said` or `Strait`; `inflation` does not
  match `inflationary`. Korean keywords are plain substring matches.
- `%`, `_`, and regex characters in the keyword are matched literally.

### `get_editorial`

Full text of one editorial by `id` or `link` (`id` wins if both are given), with
title, outlet, date, and link. Bodies over 25,000 characters are truncated and
flagged `truncated: true`.

### `list_media_outlets`

Every outlet name with its editorial count, plus the total.

## Why it's safe to expose openly

- No auth gate on the MCP endpoint itself — anyone with the URL can call it.
- That's fine here because the `editorial` table's only RLS policy
  (`editorial_public_select`) grants `SELECT` to `anon`/`authenticated` — the
  app can never write, and it exposes nothing that isn't already readable
  with the public anon key.
- The `editorial_deduped` view the app searches is `security_invoker`, so it is
  read under that same policy, and anon writes through it are rejected.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in SUPABASE_ANON_KEY
npm run dev
```

The MCP endpoint is `http://localhost:3000/api/mcp` (Streamable HTTP,
JSON-RPC 2.0). Test it with:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Deploying to Vercel

```bash
vercel link
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel deploy --prod
```

## Connecting a client

Any MCP client that supports Streamable HTTP — no auth needed:

```json
{
  "mcpServers": {
    "editorial": {
      "url": "https://gqai-editorial-mcp.vercel.app/api/mcp"
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
      "args": ["-y", "mcp-remote", "https://gqai-editorial-mcp.vercel.app/api/mcp"]
    }
  }
}
```

## Notes on the underlying data

- Search and outlet counts read the `editorial_deduped` view, which hides Korea
  JoongAng Daily English-only rows whose `"<title> (KOR)"` twin exists (the twin
  carries the same English text plus a Korean translation). `get_editorial` still
  reads the table, so a hidden row's `id` or `link` resolves. The view is defined
  in [`db/editorial_deduped_view.sql`](db/editorial_deduped_view.sql).
- `title`/`content` have `pg_trgm` GIN indexes (`editorial_title_trgm_idx`,
  `editorial_content_trgm_idx`) added specifically to make `ILIKE` search fast
  enough to stay under Postgres' statement timeout — without them,
  `search_editorials` times out on the 23k-row table. Keywords with an English
  edge are matched with a case-insensitive regex (`~*`) instead of `ILIKE`;
  a full-body regex scan takes roughly 0.6s.
- `published_at` is used as the canonical date for filtering/sorting (falls
  back to `pubdate` for display if null, though in practice both are always
  populated).
