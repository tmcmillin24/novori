-- Read-only, catalog-wide health check. No reader data or provider requests.
with edition_art as (
  select work_id,
    count(*) as editions,
    count(*) filter (where lower(coalesce(metadata #>> '{volumeInfo,language}', language, '')) in ('en','eng','english')
      and coalesce(metadata #>> '{volumeInfo,imageLinks,extraLarge}', metadata #>> '{volumeInfo,imageLinks,large}',
        metadata #>> '{volumeInfo,imageLinks,medium}', metadata #>> '{volumeInfo,imageLinks,thumbnail}') is not null) as english_metadata_covers
  from public.book_editions where provider in ('isbndb','google_books') group by work_id
), health as (
  select w.id, w.title, w.primary_author, a.editions, a.english_metadata_covers,
    s.status, coalesce(s.locked,false) as locked, c.provider as selected_provider, c.url as selected_url,
    e.isbn_13 as selected_isbn,
    case when c.provider = 'hardcover' and not coalesce(s.locked,false) then 'legacy_hardcover_selection'
      when c.url is null and a.english_metadata_covers > 0 then 'recoverable_cached_artwork'
      when c.url is null then 'missing_publisher_artwork'
      else null end as issue
  from public.book_works w join edition_art a on a.work_id = w.id
  left join public.book_cover_selections s on s.work_id = w.id and s.status = 'selected'
  left join public.book_cover_candidates c on c.id = s.candidate_id
  left join public.book_editions e on e.id = c.edition_id
)
select jsonb_build_object(
  'summary', jsonb_build_object(
    'catalog_works', count(*),
    'selected_covers', count(*) filter (where selected_url is not null),
    'legacy_hardcover_selections', count(*) filter (where issue = 'legacy_hardcover_selection'),
    'recoverable_cached_artwork', count(*) filter (where issue = 'recoverable_cached_artwork'),
    'missing_publisher_artwork', count(*) filter (where issue = 'missing_publisher_artwork')
  ),
  'issues', coalesce((select jsonb_agg(row_to_json(t)) from
    (select * from health where issue is not null order by issue,title,id limit 500) t), '[]'::jsonb)
) as catalog_cover_health from health;
