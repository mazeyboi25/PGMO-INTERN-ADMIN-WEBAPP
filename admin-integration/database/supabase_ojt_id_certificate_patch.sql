-- PGMO OJT ID Requests Supabase Patch
-- Run this in Supabase SQL Editor before using the OJT ID request feature.
-- This table stores the student's submitted ID details so the admin can view and print them from another device.

create table if not exists public.ojt_id_requests (
    id uuid primary key default gen_random_uuid(),
    student_account_id uuid,
    student_id text not null,
    student_name text not null,
    course text,
    office_assigned text,
    school text,
    contact_number text,
    profile_picture_url text,
    purpose text,
    status text not null default 'Pending',
    admin_remarks text,
    approved_by text,
    approved_at timestamptz,
    ready_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.ojt_id_requests
add column if not exists student_account_id uuid,
add column if not exists course text,
add column if not exists office_assigned text,
add column if not exists school text,
add column if not exists contact_number text,
add column if not exists profile_picture_url text,
add column if not exists purpose text,
add column if not exists status text not null default 'Pending',
add column if not exists admin_remarks text,
add column if not exists approved_by text,
add column if not exists approved_at timestamptz,
add column if not exists ready_at timestamptz,
add column if not exists deleted_at timestamptz,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_ojt_id_requests_student_id
on public.ojt_id_requests(student_id);

create index if not exists idx_ojt_id_requests_status
on public.ojt_id_requests(status);

create index if not exists idx_ojt_id_requests_deleted_at
on public.ojt_id_requests(deleted_at);

alter table public.ojt_id_requests enable row level security;

drop policy if exists "Allow public read ojt id requests" on public.ojt_id_requests;
drop policy if exists "Allow public insert ojt id requests" on public.ojt_id_requests;
drop policy if exists "Allow public update ojt id requests" on public.ojt_id_requests;
drop policy if exists "Allow public delete ojt id requests" on public.ojt_id_requests;

create policy "Allow public read ojt id requests"
on public.ojt_id_requests
for select
using (true);

create policy "Allow public insert ojt id requests"
on public.ojt_id_requests
for insert
with check (true);

create policy "Allow public update ojt id requests"
on public.ojt_id_requests
for update
using (true)
with check (true);

create policy "Allow public delete ojt id requests"
on public.ojt_id_requests
for delete
using (true);

-- Optional soft delete example for admin tools:
-- update public.ojt_id_requests
-- set deleted_at = now(), status = 'Deleted', updated_at = now()
-- where id = '<REQUEST_ID>';
