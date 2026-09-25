-- Applied to the production Supabase project as migration `editorial_deduped_view`
-- (2026-09-26). Kept here because search_editorials and list_media_outlets read
-- this view; re-run it on any new database this server points at.
--
-- Korea JoongAng Daily publishes each column twice: an English-only row and a
-- "<title> (KOR)" row that repeats the English text and adds a Korean translation.
-- editorial_deduped hides the English-only row when its (KOR) twin exists.
-- Twins are matched on the title with the "(KOR)" suffix stripped, since spacing
-- before "(KOR)" varies.

create index if not exists editorial_kor_base_title_idx
  on public.editorial (media, (regexp_replace(title, '\s*\(KOR\)\s*$', '')))
  where title ~ '\(KOR\)\s*$';

-- security_invoker: callers see the view through editorial's own RLS policy
-- (editorial_public_select), not the view owner's privileges.
create or replace view public.editorial_deduped
with (security_invoker = true) as
select e.*
from public.editorial e
where not (
  e.media = '코리아중앙데일리'
  and e.title !~ '\(KOR\)\s*$'
  and exists (
    select 1
    from public.editorial k
    where k.media = e.media
      and k.title ~ '\(KOR\)\s*$'
      and regexp_replace(k.title, '\s*\(KOR\)\s*$', '') = e.title
  )
);

comment on view public.editorial_deduped is
  'editorial minus Korea JoongAng Daily English-only rows that have a "(KOR)" twin. Read by the editorial MCP server.';

grant select on public.editorial_deduped to anon, authenticated;
