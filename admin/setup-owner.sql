-- Run after the admin migration. Replace this UUID with YOUR verified main Novori Auth user ID.
-- Never grant ownership to an account selected by an unverified email or a test reader.
do $$declare owner_user uuid:='00000000-0000-0000-0000-000000000000';begin
 if not exists(select 1 from auth.users where id=owner_user and email_confirmed_at is not null)
 or not public.novori_account_active(owner_user) or public.novori_reader_restricted(owner_user) then
  raise exception 'Set owner_user to your verified, active main Novori Auth user ID.';
 end if;
 insert into public.novori_admin_members(user_id,role,enabled,email_alerts)
 values(owner_user,'owner',true,true) on conflict(user_id) do update set role='owner',enabled=true;
end$$;
