begin;
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='reading_reminder_preferences' and column_name='yearly_recap') then
  alter table public.reading_reminder_preferences add column yearly_recap boolean not null default true;
  update public.reading_reminder_preferences set yearly_recap=monthly_recap;
 end if;
end $$;
alter table public.reading_reminder_preferences add column if not exists yearly_recap_enabled_at timestamptz not null default now();
create table if not exists public.novori_yearly_recap_deliveries (
 user_id uuid not null references auth.users(id) on delete cascade,
 reading_year integer not null check(reading_year between 1970 and 9998),
 evaluated_at timestamptz not null default now(), notified boolean not null default false,
 primary key(user_id,reading_year)
);
alter table public.novori_yearly_recap_deliveries enable row level security;
revoke all on public.novori_yearly_recap_deliveries from public,anon,authenticated;

create or replace function public.novori_yearly_preference_guard()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='INSERT' then new.yearly_recap_enabled_at:=now();
 elsif new.yearly_recap and not old.yearly_recap then new.yearly_recap_enabled_at:=now();
 else new.yearly_recap_enabled_at:=old.yearly_recap_enabled_at; end if;
 if not new.yearly_recap then
  delete from public.notifications where recipient_id=new.user_id and entity_type='reading_reminder' and metadata->>'reading_reminder_kind'='yearly_recap';
 end if;
 return new;
end $$;
drop trigger if exists novori_yearly_preference_guard on public.reading_reminder_preferences;
create trigger novori_yearly_preference_guard before insert or update on public.reading_reminder_preferences
 for each row execute function public.novori_yearly_preference_guard();

create or replace function public.novori_sync_reading_reminders(device_timezone text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 -- Existing sync owns authentication, timezone validation and default/opt-out rules.
 perform public.sync_reading_reminder_device(device_timezone);
 select to_jsonb(p) into result from public.reading_reminder_preferences p where p.user_id=auth.uid();
 return result;
end $$;

create or replace function public.novori_generate_yearly_recap_reminders(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare p record; local_now timestamp; due timestamptz; recap_year integer; summary jsonb; recorded integer; total integer:=0;
 prior_sub text:=current_setting('request.jwt.claim.sub',true); prior_claims text:=current_setting('request.jwt.claims',true);
begin
 for p in select * from public.reading_reminder_preferences where yearly_recap
  and public.novori_account_active(user_id) and not public.novori_reader_restricted(user_id)
  and extract(month from p_now at time zone timezone)=1 and extract(day from p_now at time zone timezone)=1
  and (p_now at time zone timezone)::time>=time '18:00'
  and yearly_recap_enabled_at<=(((p_now at time zone timezone)::date+time '18:00') at time zone timezone)
  and not exists(select 1 from public.novori_yearly_recap_deliveries d where d.user_id=reading_reminder_preferences.user_id
    and d.reading_year=extract(year from p_now at time zone timezone)::integer-1)
  order by user_id limit 100
 loop
  begin
   local_now:=p_now at time zone p.timezone;
   due:=(local_now::date+time '18:00') at time zone p.timezone;
   if p_now<due or p.yearly_recap_enabled_at>due then continue; end if;
   recap_year:=extract(year from local_now)::integer-1;
   perform set_config('request.jwt.claim.sub',p.user_id::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',p.user_id,'role','authenticated')::text,true);
   execute 'select to_jsonb(public.get_year_in_reading_insights($1,$2))' into summary using recap_year,p.timezone;
   perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
   perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
   if (summary->>'year')::integer is distinct from recap_year then raise exception 'Year summary mismatch'; end if;
   insert into public.novori_yearly_recap_deliveries(user_id,reading_year,evaluated_at)
   values(p.user_id,recap_year,p_now) on conflict do nothing;
   get diagnostics recorded=row_count;
   if recorded=0 then continue; end if;
   if coalesce((summary->>'finishedBooks')::integer,0)=0 and coalesce((summary->>'daysRead')::integer,0)=0 then continue; end if;
   insert into public.notifications(recipient_id,type,title,body,entity_type,metadata,created_at)
   values(p.user_id,'system','Your '||recap_year||' Year in Reading is ready','Your yearly reading recap is ready.',
    'reading_reminder',jsonb_build_object('reading_reminder_kind','yearly_recap','reference_date',make_date(recap_year,12,31)::text),p_now);
   update public.novori_yearly_recap_deliveries set notified=true where user_id=p.user_id and reading_year=recap_year;
   total:=total+1;
  exception when others then
   perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
   perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
   raise warning 'Yearly recap generation failed (%); retry remains available',SQLSTATE;
  end;
 end loop;
 return total;
end $$;
revoke all on function public.novori_yearly_preference_guard(),public.novori_sync_reading_reminders(text),public.novori_generate_yearly_recap_reminders(timestamptz) from public,anon,authenticated;
grant execute on function public.novori_sync_reading_reminders(text) to authenticated;
grant execute on function public.novori_generate_yearly_recap_reminders(timestamptz) to service_role;
commit;
