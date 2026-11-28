begin;
create or replace function public.novori_push_copy(n public.notifications, events integer)
returns table(title text, body text) language plpgsql set search_path=pg_catalog,public as $$
declare
 book text := nullif(left(trim(regexp_replace(n.metadata->>'book_title','[[:cntrl:]]',' ','g')),80),'');
 ref text := n.metadata->>'reference_date';
 kind text := n.metadata->>'reading_reminder_kind';
 target text;
begin
 title := coalesce(public.novori_push_preview(n.id,events),'Novori update');
 if n.entity_type='reading_reminder' then
  case kind
   when 'daily_checkin' then
    title := 'Get a few pages in today? 📖'; body := 'Check in for today’s read.';
   when 'still_reading' then
    title := case when book is null then 'Still reading?' else 'Still reading '||book||'?' end;
    body := 'Pick up where you left off, or update your reading status.';
   when 'weekly_recap' then
    title := 'Your week in books 📚'; body := 'See your reading activity from last week.';
   when 'monthly_recap' then
    title := case when ref ~ '^[0-9]{4}-(0[1-9]|1[0-2])-[0-9]{2}$'
      then to_char(make_date(2000,substring(ref,6,2)::integer,1),'FMMonth')||', by the book ✨'
      else 'Your month in books ✨' end;
    body := 'See what you read last month.';
   when 'yearly_recap' then
    title := 'Your '||case when ref ~ '^[0-9]{4}-' then left(ref,4)||' ' else '' end||'Year in Reading is here 🎉';
    body := 'Look back at the books and reading days that shaped your year.';
   else null;
  end case;
 elsif n.type in ('post_vote','comment_vote') and n.metadata->>'vote_value'='1' then
  target := case when n.type='post_vote' then 'post' else 'comment' end;
  title := case when events>1 then 'Your '||target||' got '||events||' upvotes'
    else 'Someone upvoted your '||target end;
 elsif n.type='follow_request' then body := 'Review their request.';
 elsif n.type='reply' then body := 'Open the conversation.';
 elsif n.type='club_invite' then body := 'Take a look at the club.';
 elsif n.type='comment' and book is not null then body := 'On your post about '||book||'.';
 elsif n.type='review_like' and book is not null then body := 'For your review of '||book||'.';
 elsif n.type='reading_finished' then title := title||' 📚';
 end if;
 if lower(trim(title))=lower(trim(body)) then body:=null; end if;
 return next;
end $$;
revoke all on function public.novori_push_copy(public.notifications,integer) from public,anon,authenticated;

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
 'title',copy.title,'body',copy.body)), '[]'::jsonb)
 into result from claimed o join public.novori_push_devices d on d.install_id=o.install_id join public.notifications n on n.id=o.notification_id
 cross join lateral public.novori_push_copy(n,o.vote_events) copy;
 return result;
end $$;

commit;
