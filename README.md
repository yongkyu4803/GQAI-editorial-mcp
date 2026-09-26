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

## Data coverage

Snapshot taken **2026-09-26** from `editorial_deduped` (the rows the tools
search). Re-run [`db/coverage.sql`](db/coverage.sql) to refresh these numbers.
All dates are KST.

- **Range:** 2025-05-01 → 2026-09-24, 23,186 editorials. `published_at` is never null.
- **Last insert:** 2026-09-24 06:00. Nothing arrived through the snapshot, which
  falls in the Chuseok holiday (2026-09-24 – 09-26); past holidays show the
  same kind of gap. If it outlasts the holiday, check the collector.
- **Collector schedule:** rows land at 00:00, 03:00, 06:00, 12:00, and 18:00
  (insert times over the last 14 days).
- **Volume:** about 60 editorials per weekday.
- **Outlets that start later than May 2025:** 강원일보 and 강원도민일보
  (2025-05-07), 한경비즈니스 (2025-09-15, 7 total), 머니투데이 (2026-03-05),
  동행미디어 시대 (2026-03-31), 아시아경제 (2026-06-17), 전자신문 (2026-06-24),
  kbc광주방송 (one editorial, 2026-07-15). Date-range comparisons across
  outlets before these dates aren't like-for-like.
- **Sparse outlets:** 주간조선 (43), 미디어오늘 (44), 전자신문 (12),
  한경비즈니스 (7) — a few dozen or fewer over the whole range, so don't expect
  them in any given week.
- **Days with no editorials** (54 in all):
  - Saturdays up to 2026-02-07 (38 of them): Saturday was routinely empty until
    then, so treat those as normal. Since then only 2026-04-11 is empty, next
    to the 04-10 gap below.
  - Public holidays: 2025-06-06, 2025-08-15, 2025-10-03 – 10-08 (Chuseok),
    2026-02-16 – 02-17 (Seollal; 02-16 has 1 editorial).
  - A few Sundays: 2025-05-04, 2025-12-28, 2026-02-08, 2026-02-15.
  - **Unexplained weekday gaps:** 2025-09-26 (Fri), 2026-01-30 (Fri), and
    2026-04-10 (Fri). Treat these as possible collection misses.

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
