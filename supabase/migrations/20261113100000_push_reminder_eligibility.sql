begin;
create or replace function public.novori_push_allowed(p_notification uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare n public.notifications; prefs jsonb; pref text; reminder text; club uuid; experience jsonb; blocked boolean;
 prior_sub text:=current_setting('request.jwt.claim.sub',true); prior_claims text:=current_setting('request.jwt.claims',true);
begin
 select * into n from public.notifications where id=p_notification;
 if not found or n.read_at is not null or n.created_at < now()-interval '1 day'
 or not public.novori_account_active(n.recipient_id) or public.novori_reader_restricted(n.recipient_id) then return false; end if;
 if n.actor_id is not null and (not public.novori_account_active(n.actor_id) or public.novori_reader_restricted(n.actor_id)) then return false; end if;
 if n.actor_id is not null then
  perform set_config('request.jwt.claim.sub',n.recipient_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',n.recipient_id,'role','authenticated')::text,true);
  execute 'select public.is_reader_blocked_by_viewer($1)' into blocked using n.actor_id;
  if not coalesce(blocked,false) then
   perform set_config('request.jwt.claim.sub',n.actor_id::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',n.actor_id,'role','authenticated')::text,true);
   execute 'select public.is_reader_blocked_by_viewer($1)' into blocked using n.recipient_id;
  end if;
  perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
  perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
  if coalesce(blocked,false) then return false; end if;
 end if;
 if n.type='system' and n.entity_type='reading_reminder' then
  reminder:=n.metadata->>'reading_reminder_kind';
  if reminder not in ('daily_checkin','still_reading','weekly_recap','monthly_recap','yearly_recap') or reminder is null then return false; end if;
  select to_jsonb(p) into prefs from public.reading_reminder_preferences p where user_id=n.recipient_id;
  if reminder='daily_checkin' and exists(select 1 from public.reading_checkins c where c.user_id=n.recipient_id and c.local_date=(now() at time zone coalesce(prefs->>'timezone','UTC'))::date) then return false; end if;
  return coalesce((prefs->>reminder)::boolean,false);
 end if;
 if n.type='system' and n.entity_type='push_test' then return true; end if;
 pref:=case when n.type in ('follow','follow_request','follow_request_accepted') then 'new_followers'
 when n.type in ('post_like','review_like','post_vote','comment_vote','comment','reply') then 'reactions_and_replies'
 when n.type='club_invite' then 'club_invites' when n.type in ('club_post','club_event','club_member') then 'club_activity'
 when n.type='reading_started' then 'reading_started' when n.type='reading_finished' then 'reading_finished' end;
 if pref is null then return false; end if;
 select to_jsonb(p) into prefs from public.notification_preferences p where user_id=n.recipient_id;
 if prefs is not null and not coalesce((prefs->>pref)::boolean,true) then return false; end if;
 -- Replies can carry club_id even when entity_type is post.
 club:=case when n.entity_type='club' then n.entity_id::text::uuid else nullif(n.metadata->>'club_id','')::uuid end;
 if club is not null and n.type<>'club_invite' then
  perform set_config('request.jwt.claim.sub',n.recipient_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',n.recipient_id,'role','authenticated')::text,true);
  execute 'select to_jsonb(public.get_club_member_experience($1))' into experience using club;
  perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
  perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
  if not coalesce((experience->>'notifications_enabled')::boolean,false) or not coalesce((experience->>'global_notifications_enabled')::boolean,false) then return false; end if;
 end if;
 return true;
exception when others then
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
 perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
 return false; -- Never send when access/preferences cannot be verified.
end $$;

revoke all on function public.novori_push_allowed(uuid) from public,anon,authenticated;
commit;
