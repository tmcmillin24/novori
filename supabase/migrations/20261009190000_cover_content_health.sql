-- Shared CDN-content decisions, separate from edition metadata and provider caches.
create table if not exists public.book_cover_content_health (
 url text primary key check (length(url) <= 4096),
 status text not null check (status in ('image','placeholder','missing')),
 expires_at timestamptz not null
);
alter table public.book_cover_content_health enable row level security;
revoke all on public.book_cover_content_health from public, anon, authenticated;
grant select, insert, update, delete on public.book_cover_content_health to service_role;
-- Confirmed ISBNdb missing-cover graphic downloaded and visually verified Oct 9.
-- This is a content-health result, not a title/ISBN preference or edition repair.
insert into public.book_cover_content_health(url,status,expires_at)
values ('https://images.isbndb.com/covers/4996893482325.jpg','placeholder',now()+interval '7 days')
on conflict(url) do update set status=excluded.status,expires_at=excluded.expires_at;
-- Other URLs inspected in the same CDN audit: real images and one confirmed 404.
insert into public.book_cover_content_health(url,status,expires_at) values
 ('https://images.isbndb.com/covers/4412063482758.jpg','image',now()+interval '30 days'),
 ('https://images.isbndb.com/covers/4484103482758.jpg','image',now()+interval '30 days'),
 ('https://images.isbndb.com/covers/1128733482760.jpg','image',now()+interval '30 days'),
 ('https://images.isbndb.com/covers/7805873482754.jpg','missing',now()+interval '15 minutes')
on conflict(url) do update set status=excluded.status,expires_at=excluded.expires_at;
