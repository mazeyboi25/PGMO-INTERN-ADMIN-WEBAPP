create table if not exists public.admin_activity_log (
    id uuid primary key default gen_random_uuid(),
    admin_name text not null default 'admin',
    action_type text not null,
    entity_type text,
    entity_name text,
    details jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_admin_activity_log_created_at
on public.admin_activity_log(created_at desc);

create index if not exists idx_admin_activity_log_action_type
on public.admin_activity_log(action_type);

alter table public.admin_activity_log enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'admin_activity_log'
          and policyname = 'Allow anon admin activity log access'
    ) then
        create policy "Allow anon admin activity log access"
        on public.admin_activity_log
        for all
        using (true)
        with check (true);
    end if;
end $$;
