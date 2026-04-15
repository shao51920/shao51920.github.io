-- Repair script for the current production project.
-- Run this in Supabase SQL Editor once.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  nickname text default '匿名觉者',
  is_admin boolean default false,
  created_at timestamptz default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists nickname text default '匿名觉者';
alter table public.profiles add column if not exists is_admin boolean default false;
alter table public.profiles add column if not exists created_at timestamptz default now();

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');

alter table public.profiles alter column email set not null;

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = '公开读取 profiles'
  ) then
    create policy "公开读取 profiles" on public.profiles for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = '本人更新 profiles'
  ) then
    create policy "本人更新 profiles" on public.profiles for update using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = '本人插入 profiles'
  ) then
    create policy "本人插入 profiles" on public.profiles for insert with check (auth.uid() = id);
  end if;
end $$;

insert into public.profiles (id, email, nickname)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'nickname', split_part(u.email, '@', 1), '匿名觉者')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nickname)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1), '匿名觉者')
  )
  on conflict (id) do update
    set email = excluded.email,
        nickname = excluded.nickname;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  page_type text not null,
  content text default '',
  image_url text default null,
  is_hidden boolean default false,
  created_at timestamptz default now()
);

alter table public.comments add column if not exists user_id uuid references auth.users on delete cascade;
alter table public.comments add column if not exists page_type text;
alter table public.comments add column if not exists content text default '';
alter table public.comments add column if not exists image_url text default null;
alter table public.comments add column if not exists is_hidden boolean default false;
alter table public.comments add column if not exists created_at timestamptz default now();

alter table public.comments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'comments' and policyname = '公开读取未隐藏评论'
  ) then
    create policy "公开读取未隐藏评论" on public.comments
      for select using (is_hidden = false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'comments' and policyname = '登录用户发表评论'
  ) then
    create policy "登录用户发表评论" on public.comments
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'comments' and policyname = '本人删除评论'
  ) then
    create policy "本人删除评论" on public.comments
      for delete using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'comments' and policyname = '管理员全部读取'
  ) then
    create policy "管理员全部读取" on public.comments
      for select using (
        exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'comments' and policyname = '管理员隐藏评论'
  ) then
    create policy "管理员隐藏评论" on public.comments
      for update using (
        exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'comments' and policyname = '管理员删除评论'
  ) then
    create policy "管理员删除评论" on public.comments
      for delete using (
        exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
      );
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('comment-images', 'comment-images', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = '登录用户上传图片'
  ) then
    create policy "登录用户上传图片" on storage.objects
      for insert with check (
        bucket_id = 'comment-images' and auth.role() = 'authenticated'
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = '公开读取图片'
  ) then
    create policy "公开读取图片" on storage.objects
      for select using (bucket_id = 'comment-images');
  end if;
end $$;
