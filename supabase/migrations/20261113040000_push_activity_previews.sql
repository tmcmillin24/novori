begin;
alter table public.novori_push_outbox add column if not exists vote_group text;
alter table public.novori_push_outbox add column if not exists vote_events integer not null default 1;
create unique index if not exists novori_push_vote_group on public.novori_push_outbox(install_id,generation,vote_group) where vote_group is not null;

-- Render templates from structured event types. Never expose comment/review text
-- or voter identity, even if upstream notification titles contain those details.
create or replace function public.novori_push_preview(p_notification uuid,p_events integer default 1)
returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare n public.notifications; actor text; target text; direction text;
begin
 select * into n from public.notifications where id=p_notification;
 if not found then return null; end if;
 if n.type in ('comment_vote','post_vote') then
  direction:=n.metadata->>'vote_value';
  if direction is distinct from '1' then return null; end if;
  target:=case when n.type='comment_vote' then 'comment' else 'post' end;
  return case when p_events>1 then 'Your '||target||' received new upvotes.' else 'Someone upvoted your '||target||'.' end;
 end if;
 select nullif(trim(p.display_name),'') into actor from public.profiles p where p.id=n.actor_id;
 actor:=coalesce(actor,nullif(trim(to_jsonb(n)->>'actor_display_name'),''),'Someone');
 actor:=left(regexp_replace(actor,'[[:cntrl:]]',' ','g'),60);
 return case n.type
 when 'comment' then actor||' commented on your post.'
 when 'reply' then actor||' replied to your comment.'
 when 'follow' then actor||' started following you.'
 when 'follow_request' then actor||' requested to follow you.'
 when 'follow_request_accepted' then actor||' accepted your follow request.'
 when 'post_like' then actor||' liked your post.'
 when 'review_like' then actor||' liked your review.'
 when 'club_invite' then actor||' invited you to a club.'
 when 'club_post' then actor||' posted in your club.'
 when 'club_event' then 'There is an event update in your club.'
 when 'club_member' then 'There is a membership update in your club.'
 when 'reading_started' then actor||' started reading a book.'
 when 'reading_finished' then actor||' finished reading a book.'
 when 'system' then case
  when n.entity_type='push_test' then 'Phone notifications are working.'
  when n.entity_type='reading_reminder' then case n.metadata->>'reading_reminder_kind'
   when 'weekly_recap' then 'Your weekly reading recap is ready.'
   when 'monthly_recap' then 'Your monthly reading recap is ready.'
   when 'daily_checkin' then 'Read today? Check in to keep your reading streak going.'
   when 'still_reading' then 'Still reading? Update your reading progress in Novori.'
   else 'You have a reading update waiting in Novori.' end
  else 'You have an update waiting in Novori.' end
 else 'You have an update waiting in Novori.' end;
end $$;

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
   case when grouping is null then now() else now()+interval '2 minutes' end
 from public.novori_push_devices d where d.user_id=new.recipient_id and d.enabled and d.expo_token is not null
 on conflict(install_id,generation,vote_group) where vote_group is not null do update
 set vote_events=novori_push_outbox.vote_events+1,notification_id=excluded.notification_id,updated_at=now()
 where novori_push_outbox.state='pending';
 return new;
end $$;

create or replace function public.novori_claim_push()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 delete from public.novori_push_outbox where state in ('delivered','failed','skipped','uncertain') and updated_at<now()-interval '30 days';
 -- Ambiguous sends are not blindly replayed; receipts are safe to retry.
 update public.novori_push_outbox set state='uncertain',error_code='worker_interrupted',updated_at=now() where state='sending' and updated_at<now()-interval '5 minutes';
 update public.novori_push_outbox set state='receipt',available_at=now(),updated_at=now() where state='checking' and updated_at<now()-interval '5 minutes';
 update public.novori_push_outbox o set state='skipped',updated_at=now()
 where o.state='pending' and o.available_at<=now() and
 (not exists(select 1 from public.novori_push_devices d where d.install_id=o.install_id and d.generation=o.generation and d.user_id=o.recipient_id and d.enabled) or not public.novori_push_allowed(o.notification_id) or public.novori_push_preview(o.notification_id,o.vote_events) is null);
 with candidates as (
 select o.id from public.novori_push_outbox o where o.state in ('pending','receipt') and o.available_at<=now()
 order by o.available_at,o.id limit 25 for update skip locked
 ), claimed as (
 update public.novori_push_outbox o set state=case when state='receipt' then 'checking' else 'sending' end,lease_id=gen_random_uuid(),attempts=attempts+1,updated_at=now()
 from candidates c where o.id=c.id returning o.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'lease',o.lease_id,'state',o.state,'attempts',o.attempts,'ticket',o.ticket_id,
 'token',d.expo_token,'recipient',o.recipient_id,'notification',o.notification_id,
 'title',case when n.entity_type='reading_reminder' then n.title else 'Novori' end,
 'body',coalesce(public.novori_push_preview(n.id,o.vote_events),'You have an update waiting in Novori.'))), '[]'::jsonb)
 into result from claimed o join public.novori_push_devices d on d.install_id=o.install_id join public.notifications n on n.id=o.notification_id;
 return result;
end $$;

create or replace function public.novori_push_still_valid(p_id bigint,p_lease uuid)
returns boolean language sql security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.novori_push_outbox o join public.novori_push_devices d on d.install_id=o.install_id
 where o.id=p_id and o.lease_id=p_lease and o.state='sending' and d.generation=o.generation and d.user_id=o.recipient_id and d.enabled and public.novori_push_allowed(o.notification_id) and public.novori_push_preview(o.notification_id,o.vote_events) is not null);
$$;

revoke all on function public.novori_push_preview(uuid,integer) from public,anon,authenticated;
-- Existing worker functions retain service-only privileges on replacement.
commit;
