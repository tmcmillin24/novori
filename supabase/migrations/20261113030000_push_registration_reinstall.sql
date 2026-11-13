begin;
create or replace function public.novori_register_push_device(p_install uuid,p_secret text,p_token text,p_platform text,p_project uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare reader uuid:=auth.uid(); old public.novori_push_devices;
begin
 if reader is null or not public.novori_account_active(reader) or public.novori_reader_restricted(reader) then raise exception 'Account unavailable' using errcode='42501'; end if;
 if p_secret is null or p_secret !~ '^[a-f0-9]{64}$' or p_token is null or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'
 or p_platform is null or p_platform not in ('ios','android') or p_project is distinct from '30e6f9f0-79ba-4420-9217-433fa022e460'::uuid or p_install is null then raise exception 'Invalid push registration' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('novori-push-registration',0));
 select * into old from public.novori_push_devices where install_id=p_install for update;
 -- The secret is random 256-bit installation proof; not an account password.
 if found and old.secret_hash<>encode(sha256(convert_to(p_secret,'UTF8')),'hex') then raise exception 'Invalid installation proof' using errcode='42501'; end if;
 -- Reinstalls can create a new installation proof while Expo returns the
 -- same phone token. Retire the old binding only for this authenticated owner.
 if exists(select 1 from public.novori_push_devices where expo_token=p_token and install_id<>p_install and user_id is distinct from reader) then
  raise exception 'Push token is bound to another account; sign out on that installation first.' using errcode='42501';
 end if;
 update public.novori_push_devices set expo_token=null,enabled=false,generation=gen_random_uuid(),updated_at=now()
 where expo_token=p_token and install_id<>p_install and user_id=reader;
 insert into public.novori_push_devices(install_id,secret_hash,user_id,expo_token,platform,project_id)
 values(p_install,encode(sha256(convert_to(p_secret,'UTF8')),'hex'),reader,p_token,p_platform,p_project)
 on conflict(install_id) do update set
 generation=case when novori_push_devices.user_id is distinct from reader or novori_push_devices.expo_token is distinct from p_token or not novori_push_devices.enabled then gen_random_uuid() else novori_push_devices.generation end,
 user_id=reader,expo_token=p_token,platform=p_platform,project_id=p_project,enabled=true,updated_at=now();
end $$;

revoke all on function public.novori_register_push_device(uuid,text,text,text,uuid) from public,anon;
grant execute on function public.novori_register_push_device(uuid,text,text,text,uuid) to authenticated;
commit;
