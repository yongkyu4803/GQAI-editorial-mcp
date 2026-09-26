-- Reproduces the "Data coverage" snapshot in README.md. Read-only; run in the
-- Supabase SQL editor. Dates are KST. Reads editorial_deduped, the same rows the
-- MCP tools search.

-- 1. Overall and per-outlet date range, plus the latest insert by the collector.
select * from (
  select 'all' as scope, count(*) as n,
    min(published_at at time zone 'Asia/Seoul')::date as first_kst,
    max(published_at at time zone 'Asia/Seoul')::date as last_kst,
    (max(created_at) at time zone 'Asia/Seoul')::timestamp(0) as last_inserted_kst
  from public.editorial_deduped
  union all
  select media, count(*),
    min(published_at at time zone 'Asia/Seoul')::date,
    max(published_at at time zone 'Asia/Seoul')::date,
    (max(created_at) at time zone 'Asia/Seoul')::timestamp(0)
  from public.editorial_deduped
  group by media
) t
order by (scope = 'all') desc, first_kst, n desc;

-- 2. Days with no editorials between the first and last published date.
with d as (
  select (published_at at time zone 'Asia/Seoul')::date as day, count(*) as n
  from public.editorial_deduped
  group by 1
),
cal as (
  select generate_series(min(day), max(day), '1 day')::date as day from d
)
select to_char(cal.day, 'YYYY-MM-DD Dy') as empty_day
from cal
left join d using (day)
where d.n is null
order by cal.day;

-- 3. Clock times (KST) at which the collector inserted rows in the last 14 days.
select distinct to_char(created_at at time zone 'Asia/Seoul', 'HH24:MI') as insert_time_kst
from public.editorial
where created_at > now() - interval '14 days'
order by 1;
