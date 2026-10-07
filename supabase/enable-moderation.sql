-- FINAL activation only AFTER completing docs/MODERATION_SETUP.md and testing.
-- Run once in SQL Editor as postgres. Do not disable RLS on any table.
begin;
do $$declare missing integer;begin
 if to_regclass('public.novori_moderated_media') is null then raise exception 'Run the staged screening migration first.';end if;
 select count(*) into missing from storage.objects o left join public.novori_moderated_media m on m.bucket=o.bucket_id and m.path=o.name
 where o.bucket_id in ('avatars','post-media','club-covers') and m.path is null;
 if exists(select 1 from storage.buckets where id in ('avatars','post-media','club-covers','moderation-quarantine') and public) then raise exception 'Make media buckets private through the Storage API script before activation.';end if;
 if missing>0 then raise exception '% existing images still need screening; run the migration script before activation.',missing;end if;
end$$;
-- Bucket visibility was changed through the supported Storage API, not direct SQL.
update public.novori_moderation_config set enforcement_enabled=true,media_origin='https://media.novori.link',legal_version='2026-10-05-moderation' where singleton;
commit;
