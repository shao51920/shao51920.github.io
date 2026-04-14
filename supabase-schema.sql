-- ============================================================
-- Supabase Schema for 觉醒诗社 (qingye520.xyz)
-- 在 Supabase Dashboard → SQL Editor 中运行此脚本
-- ============================================================

-- 1. 用户 Profiles 表
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  nickname text default '匿名觉者',
  avatar_url text default '',
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- 启用 RLS（Row Level Security）
alter table public.profiles enable row level security;

-- Profiles 策略：任何人可读，本人可改
create policy "公开读取 profiles" on public.profiles for select using (true);
create policy "本人更新 profiles" on public.profiles for update using (auth.uid() = id);
create policy "本人插入 profiles" on public.profiles for insert with check (auth.uid() = id);

-- 新用户注册时自动创建 profile 的触发器
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nickname', '匿名觉者'),
    'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=' || new.id
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 2. 评论表
create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  page_type text not null,         -- 'soullab' 或 'objectification'
  content text default '',
  image_url text default null,
  is_hidden boolean default false, -- 管理员可隐藏
  created_at timestamptz default now()
);

-- 启用 RLS
alter table public.comments enable row level security;

-- Comments 策略
create policy "公开读取未隐藏评论" on public.comments
  for select using (is_hidden = false);

create policy "登录用户发表评论" on public.comments
  for insert with check (auth.uid() = user_id);

create policy "本人删除评论" on public.comments
  for delete using (auth.uid() = user_id);

-- 管理员可以看到和操作所有评论（包括隐藏的）
create policy "管理员全部读取" on public.comments
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "管理员隐藏评论" on public.comments
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "管理员删除评论" on public.comments
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );


-- 3. 创建 Storage Bucket（评论图片）
-- 注意：此操作也可在 Supabase Dashboard → Storage 页面手动创建
insert into storage.buckets (id, name, public)
values ('comment-images', 'comment-images', true)
on conflict do nothing;

-- Storage 策略：登录用户可上传，公开可读
create policy "登录用户上传图片" on storage.objects
  for insert with check (
    bucket_id = 'comment-images' and auth.role() = 'authenticated'
  );

create policy "公开读取图片" on storage.objects
  for select using (bucket_id = 'comment-images');
