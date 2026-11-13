begin;
create or replace function public.novori_push_preview(p_notification uuid,p_events integer default 1)
returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare n public.notifications; actor text; target text; direction text;
begin
 select * into n from public.notifications where id=p_notification;
 if not found then return null; end if;
 if n.type in ('comment_vote','post_vote') then
  direction:=n.metadata->>'vote_value';
  if direction is distinct from '1' then return null; end if;
  if n.type='comment_vote' then
   return case when p_events>1 then 'Your comment received new upvotes.' else 'Someone upvoted your comment.' end;
  end if;
 end if;
 -- The inbox title is the source of truth for named activity wording.
 -- Never copy the body: it can contain private/user-authored comment text.
 if nullif(trim(n.title),'') is not null and n.entity_type is distinct from 'push_test' then
  return left(regexp_replace(n.title,'[[:cntrl:]]',' ','g'),180);
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

revoke all on function public.novori_push_preview(uuid,integer) from public,anon,authenticated;
commit;
