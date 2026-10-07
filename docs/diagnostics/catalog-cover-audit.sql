-- Read-only, book-catalog data only. Run in the project's Supabase SQL Editor.
-- Export this result to verify real candidate URLs, editions and selections.
with target_editions as (
  select e.* from public.book_editions e
  where (e.metadata->'volumeInfo'->>'title') ~* '(hunger games|catching fire|mockingjay|sunrise on the reaping|songbirds|court of thorns|court of mist|dungeon crawler|anarchist|butcher.s masquerade|bedlam bride|fourth wing|iron flame|only the dead)'
), target_works as (
  select distinct work_id from target_editions
)
select e.provider_book_id, e.provider, e.work_id, e.isbn_13, e.isbn_10,
  e.metadata->'volumeInfo'->>'title' as title,
  e.metadata->'volumeInfo'->'authors' as authors,
  e.language, e.metadata->'volumeInfo'->>'publishedDate' as edition_date,
  s.locked, s.status, s.selector_version, s.candidate_id as selected_candidate,
  c.id as candidate_id, c.provider as cover_provider, c.source_variant,
  c.url, c.source_metadata,
  (s.candidate_id = c.id) as is_selected
from public.book_editions e
join target_works w on w.work_id = e.work_id
left join public.book_cover_selections s on s.work_id = e.work_id
left join public.book_cover_candidates c on c.edition_id = e.id
order by e.work_id, e.provider_book_id, c.id;
