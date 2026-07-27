-- Notifications table for admin-to-student updates.
create table if not exists public.ojt_notifications (
    id uuid primary key default gen_random_uuid(),
    student_id text not null,
    title text not null,
    message text not null,
    type text not null default 'info',
    related_type text,
    related_id uuid,
    is_read boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.ojt_notifications enable row level security;

drop policy if exists "Allow public read notifications" on public.ojt_notifications;
drop policy if exists "Allow public insert notifications" on public.ojt_notifications;
drop policy if exists "Allow public update notifications" on public.ojt_notifications;
drop policy if exists "Allow public delete notifications" on public.ojt_notifications;

create policy "Allow public read notifications" on public.ojt_notifications for select using (true);
create policy "Allow public insert notifications" on public.ojt_notifications for insert with check (true);
create policy "Allow public update notifications" on public.ojt_notifications for update using (true) with check (true);
create policy "Allow public delete notifications" on public.ojt_notifications for delete using (true);
