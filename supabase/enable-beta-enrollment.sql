-- Run only after installing the migration and updating/reloading Novori.
-- Re-running this does not reset the account count or enroll existing users.
begin;
do $$begin
 if not exists(select 1 from public.novori_beta_campaign c join public.clubs b on b.id=c.club_id
 where c.id and b.name='Novori Beta Testers' and b.owner_id=c.owner_id) then
  raise exception 'Beta club configuration is missing. Nothing enabled.';
 end if;
end$$;
update public.novori_beta_campaign
set enabled=true,activated_at=coalesce(activated_at,clock_timestamp()) where id;
commit;
select public.novori_beta_signup_status();
