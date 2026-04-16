create extension if not exists pgcrypto;

alter table public.comments
  add column if not exists parent_comment_id uuid references public.comments(id) on delete cascade;

create index if not exists idx_comments_page_parent_created_at
  on public.comments (page_type, parent_comment_id, created_at desc);

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

grant select on table public.comment_likes to anon;
grant select, insert, delete on table public.comment_likes to authenticated;

create index if not exists idx_comment_likes_comment_id
  on public.comment_likes (comment_id, created_at desc);

create index if not exists idx_comment_likes_user_id
  on public.comment_likes (user_id, created_at desc);

update public.profiles
set nickname = concat('觉者', 100 + abs(mod(('x' || substr(md5(id::text), 1, 8))::bit(32)::int, 9000)))
where nickname is null or btrim(nickname) = '';

with ranked as (
  select
    id,
    nickname,
    row_number() over (
      partition by lower(btrim(nickname))
      order by created_at nulls last, id
    ) as seq
  from public.profiles
  where nickname is not null and btrim(nickname) <> ''
)
update public.profiles as p
set nickname = concat(r.nickname, seq)
from ranked as r
where p.id = r.id
  and r.seq > 1;

create unique index if not exists idx_profiles_nickname_unique
  on public.profiles (lower(nickname));

alter table public.comment_likes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'comment_likes' and policyname = 'public read comment likes'
  ) then
    create policy "public read comment likes" on public.comment_likes
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'comment_likes' and policyname = 'authenticated like comments'
  ) then
    create policy "authenticated like comments" on public.comment_likes
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'comment_likes' and policyname = 'owner unlike comments'
  ) then
    create policy "owner unlike comments" on public.comment_likes
      for delete using (auth.uid() = user_id);
  end if;
end $$;
