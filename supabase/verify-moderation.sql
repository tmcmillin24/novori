-- Read-only deployment inspection; this does not prove live scanner coverage.
select enforcement_enabled,media_origin,legal_version from public.novori_moderation_config;
select id,public from storage.buckets where id in ('avatars','post-media','club-covers','moderation-quarantine');
select state,surface,count(*) from public.novori_content_screenings group by state,surface order by state,surface;
select priority,count(*) as report_rows from public.novori_report_priority where status in ('pending','reviewed') group by priority;
select o.bucket_id,count(*) as unregistered_images from storage.objects o left join public.novori_moderated_media m on m.bucket=o.bucket_id and m.path=o.name where o.bucket_id in ('avatars','post-media','club-covers') and m.path is null group by o.bucket_id;
select n.nspname,c.relname,t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and t.tgname like 'novori_%guard' order by n.nspname,c.relname;
-- Export/inspect existing installed RPC bodies, including lifecycle exemptions.
select p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_post_comment','update_post_comment','delete_post_comment','request_account_deletion','cancel_account_deletion','save_club_discussion','save_club_event','save_club_read','publish_reading_update','publish_reading_update_to_destination','publish_reading_recap_post','update_reading_recap_post');

select distinct lower(substring(url from '^https?://([^/]+)')) as catalog_image_host from (select cover_url as url from public.user_books union all select book_cover_url from public.posts union all select cover_url from public.book_stack_items) covers where url is not null;
