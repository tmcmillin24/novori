begin;
create or replace function public.novori_queue_push()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare grouping text; target text;
begin
 if new.type in ('comment_vote','post_vote') then
  -- Unknown directions fail closed rather than accidentally alerting a downvote.
  if new.metadata->>'vote_value' is distinct from '1' then return new; end if;
  target:=case when new.type='comment_vote' then coalesce(nullif(new.metadata->>'comment_id',''),case when new.entity_type='comment' then new.entity_id::text end)
    else coalesce(nullif(new.metadata->>'post_id',''),case when new.entity_type='post' then new.entity_id::text end) end;
  if target is null then return new; end if;
  grouping:=new.type||':'||target||':'||floor(extract(epoch from coalesce(new.created_at,now()))/900)::text;
 end if;
 insert into public.novori_push_outbox(notification_id,install_id,recipient_id,generation,vote_group,available_at)
 select new.id,d.install_id,new.recipient_id,d.generation,grouping,
   case when grouping is null then now() else now()+interval '15 seconds' end
 from public.novori_push_devices d where d.user_id=new.recipient_id and d.enabled and d.expo_token is not null
 on conflict(install_id,generation,vote_group) where vote_group is not null do update
 set vote_events=novori_push_outbox.vote_events+1,notification_id=excluded.notification_id,updated_at=now()
 where novori_push_outbox.state='pending';
 return new;
end $$;

-- Shorten existing unsent batches too; never replay a sent batch.
update public.novori_push_outbox set available_at=least(available_at,created_at+interval '15 seconds')
where state='pending' and vote_group is not null;
create or replace function public.novori_dispatch_due_vote_push()
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare worker_secret text; acquired boolean;
begin
 if not exists(select 1 from public.novori_push_outbox where state='pending' and vote_group is not null and available_at<=now()) then return; end if;
 update public.novori_push_wake_state set last_wake_at=clock_timestamp()
 where id=true and last_wake_at<clock_timestamp()-interval '1 second' returning true into acquired;
 if not coalesce(acquired,false) then return; end if;
 select decrypted_secret into worker_secret from vault.decrypted_secrets where name='novori_phone_push_worker' limit 1;
 if worker_secret is null then raise exception 'Push worker credential missing'; end if;
 perform net.http_post(url:='https://oanpmuiuuwljknwvyzev.supabase.co/functions/v1/phone-push',
 headers:=jsonb_build_object('Content-Type','application/json','x-novori-worker',worker_secret),body:='{}'::jsonb,timeout_milliseconds:=140000);
exception when others then
 raise warning 'Due vote push wake failed (%); scheduled retry remains active',SQLSTATE;
end $$;
revoke all on function public.novori_dispatch_due_vote_push() from public,anon,authenticated;
grant execute on function public.novori_dispatch_due_vote_push() to service_role;
commit;
