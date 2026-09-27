-- Phase 6: Book Stacks
create table if not exists public.book_stacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  visibility text not null default 'profile' check (visibility in ('profile')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.book_stack_items (
  id uuid primary key default gen_random_uuid(),
  stack_id uuid not null references public.book_stacks(id) on delete cascade,
  google_book_id text not null,
  title text not null,
  authors text[] not null default '{}',
  cover_url text,
  position integer not null check (position >= 0 and position < 10),
  created_at timestamptz not null default now(),
  unique (stack_id, google_book_id),
  unique (stack_id, position)
);

alter table public.book_stacks enable row level security;
alter table public.book_stack_items enable row level security;

drop policy if exists "book stacks readable" on public.book_stacks;
create policy "book stacks readable"
on public.book_stacks
for select
using (
  visibility = 'profile'
  or auth.uid() = user_id
);

drop policy if exists "book stacks insert own" on public.book_stacks;
create policy "book stacks insert own"
on public.book_stacks
for insert
with check (auth.uid() = user_id);

drop policy if exists "book stacks update own" on public.book_stacks;
create policy "book stacks update own"
on public.book_stacks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "book stacks delete own" on public.book_stacks;
create policy "book stacks delete own"
on public.book_stacks
for delete
using (auth.uid() = user_id);

drop policy if exists "book stack items readable" on public.book_stack_items;
create policy "book stack items readable"
on public.book_stack_items
for select
using (
  exists (
    select 1
    from public.book_stacks s
    where s.id = stack_id
      and (
        s.visibility = 'profile'
        or s.user_id = auth.uid()
      )
  )
);

drop policy if exists "book stack items insert own" on public.book_stack_items;
create policy "book stack items insert own"
on public.book_stack_items
for insert
with check (
  exists (
    select 1
    from public.book_stacks s
    where s.id = stack_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "book stack items update own" on public.book_stack_items;
create policy "book stack items update own"
on public.book_stack_items
for update
using (
  exists (
    select 1
    from public.book_stacks s
    where s.id = stack_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "book stack items delete own" on public.book_stack_items;
create policy "book stack items delete own"
on public.book_stack_items
for delete
using (
  exists (
    select 1
    from public.book_stacks s
    where s.id = stack_id
      and s.user_id = auth.uid()
  )
);

alter table public.posts
  add column if not exists book_stack_id uuid
  references public.book_stacks(id)
  on delete set null;

alter table public.posts
  drop constraint if exists posts_post_type_check;

alter table public.posts
  add constraint posts_post_type_check
  check (
    post_type in (
      'post',
      'reading_update',
      'review',
      'question',
      'book_stack'
    )
  );

notify pgrst, 'reload schema';
