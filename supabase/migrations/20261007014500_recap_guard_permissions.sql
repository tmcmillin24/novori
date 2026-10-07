begin;
-- This trigger runs on every post update. Its deletion-worker exception reads
-- private account state; authenticated readers must not receive table access.
-- Preserve the existing function body and immutable recap checks.
alter function public.novori_preserve_reading_recap_snapshot() security definer;
alter function public.novori_preserve_reading_recap_snapshot() set search_path = '';
commit;
