create table if not exists public.result_views (
  id uuid primary key default gen_random_uuid(),
  page_type text not null check (page_type in ('soullab', 'objtest')),
  created_at timestamptz not null default now()
);

create index if not exists idx_result_views_page_type_created_at
  on public.result_views (page_type, created_at desc);

alter table public.result_views enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'result_views' and policyname = '公开读取结果浏览'
  ) then
    create policy "公开读取结果浏览" on public.result_views
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'result_views' and policyname = '匿名与登录用户写入结果浏览'
  ) then
    create policy "匿名与登录用户写入结果浏览" on public.result_views
      for insert
      to anon, authenticated
      with check (page_type in ('soullab', 'objtest'));
  end if;
end $$;
