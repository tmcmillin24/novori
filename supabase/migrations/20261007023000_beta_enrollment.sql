begin;
create table if not exists public.novori_beta_campaign (
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 activated_at timestamptz,
 club_id uuid not null references public.clubs(id) on delete cascade,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 allocated integer not null default 0 check(allocated between 0 and 50)
);
create table if not exists public.novori_beta_accounts (
 slot integer primary key check(slot between 1 and 50),
 user_id uuid unique references public.profiles(id) on delete set null,
 enrolled boolean not null,
 created_at timestamptz not null default now()
);
alter table public.novori_beta_campaign enable row level security;
alter table public.novori_beta_accounts enable row level security;
revoke all on public.novori_beta_campaign,public.novori_beta_accounts from public,anon,authenticated;
grant select on public.novori_beta_campaign,public.novori_beta_accounts to service_role;
insert into public.novori_beta_campaign(id,club_id,owner_id)
select true,id,owner_id from public.clubs
where id='a50f11a3-7909-4894-bbca-56d444802974'
and owner_id='dea7ea0c-799d-4424-b5cf-81f1ffb370e7'
and name='Novori Beta Testers'
on conflict(id) do nothing;
do $$begin
 if not exists(select 1 from public.novori_beta_campaign) then
  raise exception 'The expected beta club and owner were not found. Nothing changed.';
 end if;
end$$;

create or replace function public.novori_beta_signup_status() returns jsonb
language sql security definer set search_path='' as $$
 select coalesce((select jsonb_build_object(
  'phase',case when not enabled or allocated>=50 then 'closed' when allocated<15 then 'automatic' else 'optional' end,
  'remaining',case when enabled then 50-allocated else 0 end
 ) from public.novori_beta_campaign where id),'{"phase":"closed","remaining":0}'::jsonb)
$$;
revoke all on function public.novori_beta_signup_status() from public;
grant execute on function public.novori_beta_signup_status() to anon,authenticated,service_role;

create or replace function public.novori_enroll_new_beta_account() returns trigger
language plpgsql security definer set search_path='' as $$
declare campaign public.novori_beta_campaign; metadata jsonb; auth_created timestamptz; next_slot integer; enroll boolean; peer uuid;
begin
 select * into campaign from public.novori_beta_campaign where id for update;
 if not found or not campaign.enabled or campaign.allocated>=50 then return new;end if;
 select raw_user_meta_data,created_at into metadata,auth_created from auth.users where id=new.id;
 if auth_created is null or auth_created<campaign.activated_at then return new;end if;
 if metadata->>'novori_beta_notice_version' is distinct from '2026-10-07-v1' then
  raise exception 'Update Novori to review beta enrollment before creating your account.';
 end if;
 if not exists(select 1 from public.clubs where id=campaign.club_id and owner_id=campaign.owner_id) then
  raise exception 'Beta enrollment is temporarily unavailable. Please try again later.';
 end if;
 next_slot:=campaign.allocated+1;
 enroll:=next_slot<=15 or metadata->'novori_beta_opt_in'='true'::jsonb;
 enroll:=coalesce(enroll,false);
 insert into public.novori_beta_accounts(slot,user_id,enrolled) values(next_slot,new.id,enroll);
 update public.novori_beta_campaign set allocated=next_slot where id;
 if not enroll then return new;end if;
 insert into public.club_members(club_id,user_id,role) values(campaign.club_id,new.id,'member') on conflict do nothing;
 if new.id<>campaign.owner_id and not public.is_reader_blocked_between(new.id,campaign.owner_id) then
  insert into public.follows(follower_id,following_id) values(new.id,campaign.owner_id) on conflict do nothing;
 end if;
 for peer in select b.user_id from public.novori_beta_accounts b
 where b.enrolled and b.slot<next_slot and b.user_id is not null and b.user_id<>new.id
 and public.novori_account_active(b.user_id) and not public.novori_reader_restricted(b.user_id)
 and not public.is_reader_blocked_between(new.id,b.user_id)
 and exists(select 1 from public.club_members m where m.club_id=campaign.club_id and m.user_id=b.user_id)
 loop
  insert into public.follows(follower_id,following_id) values(new.id,peer),(peer,new.id) on conflict do nothing;
 end loop;
 return new;
end$$;
revoke all on function public.novori_enroll_new_beta_account() from public,anon,authenticated;
drop trigger if exists novori_beta_new_account on public.profiles;
create trigger novori_beta_new_account after insert on public.profiles for each row execute function public.novori_enroll_new_beta_account();
commit;
