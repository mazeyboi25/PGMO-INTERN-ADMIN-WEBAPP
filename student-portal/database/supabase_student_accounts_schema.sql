-- Run this in Supabase SQL Editor.
-- Upload fix + editable profile + profile picture support.

create table if not exists public.student_accounts (
    id uuid primary key default gen_random_uuid(),
    student_id text not null unique,
    full_name text not null,
    email text not null unique,
    phone text,
    contact_number text,
    school text,
    course text not null,
    office_assigned text not null default 'Not assigned',
    password_hash text not null,
    status text not null default 'Active',
    ojt_status text not null default 'Pending',
    completed_hours numeric not null default 0,
    required_hours numeric not null default 0,
    profile_picture_url text,
    profile_picture_path text,
    supervisor text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_login_at timestamptz
);

alter table public.student_accounts add column if not exists phone text;
alter table public.student_accounts add column if not exists contact_number text;
alter table public.student_accounts add column if not exists school text;
alter table public.student_accounts add column if not exists profile_picture_url text;
alter table public.student_accounts add column if not exists profile_picture_path text;
alter table public.student_accounts add column if not exists ojt_status text not null default 'Pending';
alter table public.student_accounts add column if not exists completed_hours numeric not null default 0;
alter table public.student_accounts add column if not exists required_hours numeric not null default 0;
alter table public.student_accounts add column if not exists supervisor text;
alter table public.student_accounts add column if not exists updated_at timestamptz not null default now();
alter table public.student_accounts add column if not exists last_login_at timestamptz;

alter table public.student_accounts alter column office_assigned set default 'Not assigned';
alter table public.student_accounts alter column completed_hours type numeric using completed_hours::numeric;
alter table public.student_accounts alter column required_hours type numeric using required_hours::numeric;
alter table public.student_accounts alter column completed_hours set default 0;
alter table public.student_accounts alter column required_hours set default 0;

alter table public.student_accounts enable row level security;

drop policy if exists "Allow public student account registration" on public.student_accounts;
drop policy if exists "Allow public student account login read" on public.student_accounts;
drop policy if exists "Allow public student account login update" on public.student_accounts;
drop policy if exists "Allow public student account delete" on public.student_accounts;

create policy "Allow public student account registration" on public.student_accounts for insert with check (true);
create policy "Allow public student account login read" on public.student_accounts for select using (true);
create policy "Allow public student account login update" on public.student_accounts for update using (true) with check (true);
create policy "Allow public student account delete" on public.student_accounts for delete using (true);

create table if not exists public.ojt_dtr_forms (
    id uuid primary key default gen_random_uuid(),
    student_account_id uuid,
    student_id text not null,
    student_name text not null,
    course text,
    office_assigned text,
    month text not null,
    month_label text,
    regular_days text,
    saturdays text,
    entries jsonb not null default '[]'::jsonb,
    total_hours numeric not null default 0,
    notes text,
    status text not null default 'Pending',
    admin_remarks text,
    approved_by text,
    approved_at timestamptz,
    created_at timestamptz not null default now()
);

alter table public.ojt_dtr_forms enable row level security;

drop policy if exists "Allow public read dtr forms" on public.ojt_dtr_forms;
drop policy if exists "Allow public insert dtr forms" on public.ojt_dtr_forms;
drop policy if exists "Allow public update dtr forms" on public.ojt_dtr_forms;
drop policy if exists "Allow public delete dtr forms" on public.ojt_dtr_forms;

create policy "Allow public read dtr forms" on public.ojt_dtr_forms for select using (true);
create policy "Allow public insert dtr forms" on public.ojt_dtr_forms for insert with check (true);
create policy "Allow public update dtr forms" on public.ojt_dtr_forms for update using (true) with check (true);
create policy "Allow public delete dtr forms" on public.ojt_dtr_forms for delete using (true);

create table if not exists public.ojt_uploads (
    id uuid primary key default gen_random_uuid(),
    student_id text not null,
    student_name text not null,
    course text not null,
    office_assigned text not null,
    document_type text not null,
    file_name text not null,
    file_path text not null,
    file_url text not null,
    status text not null default 'Pending',
    remarks text,
    admin_remarks text,
    created_at timestamptz default now()
);

alter table public.ojt_uploads enable row level security;

drop policy if exists "Allow public read uploads" on public.ojt_uploads;
drop policy if exists "Allow public insert uploads" on public.ojt_uploads;
drop policy if exists "Allow public update uploads" on public.ojt_uploads;

create policy "Allow public read uploads" on public.ojt_uploads for select using (true);
create policy "Allow public insert uploads" on public.ojt_uploads for insert with check (true);
create policy "Allow public update uploads" on public.ojt_uploads for update using (true) with check (true);

drop policy if exists "Allow public read ojt documents" on storage.objects;
drop policy if exists "Allow public upload ojt documents" on storage.objects;

create policy "Allow public read ojt documents" on storage.objects for select using (bucket_id = 'ojt-documents');
create policy "Allow public upload ojt documents" on storage.objects for insert with check (bucket_id = 'ojt-documents');

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

-- Name field update.
-- Student names are stored separately and displayed as LASTNAME, First Name MI.

alter table public.student_accounts
add column if not exists last_name text;

alter table public.student_accounts
add column if not exists first_name text;

alter table public.student_accounts
add column if not exists middle_initial text;


-- PGMO PATCH 2026-06: Certificate ready notification + OJT ID request system.
alter table public.student_accounts
add column if not exists certificate_ready boolean not null default false;

alter table public.student_accounts
add column if not exists certificate_ready_at timestamptz;

alter table public.student_accounts
add column if not exists certificate_ready_by text;

alter table public.student_accounts
add column if not exists ojt_id_request_allowed boolean not null default false;

alter table public.student_accounts
add column if not exists ojt_id_request_allowed_at timestamptz;

alter table public.student_accounts
add column if not exists ojt_id_request_allowed_by text;

create table if not exists public.ojt_id_requests (
    id uuid primary key default gen_random_uuid(),
    student_account_id uuid,
    student_id text not null,
    student_name text not null,
    course text,
    office_assigned text,
    purpose text,
    status text not null default 'Pending',
    admin_remarks text,
    approved_by text,
    approved_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.ojt_id_requests enable row level security;

drop policy if exists "Allow public read ojt id requests" on public.ojt_id_requests;
drop policy if exists "Allow public insert ojt id requests" on public.ojt_id_requests;
drop policy if exists "Allow public update ojt id requests" on public.ojt_id_requests;
drop policy if exists "Allow public delete ojt id requests" on public.ojt_id_requests;

create policy "Allow public read ojt id requests" on public.ojt_id_requests for select using (true);
create policy "Allow public insert ojt id requests" on public.ojt_id_requests for insert with check (true);
create policy "Allow public update ojt id requests" on public.ojt_id_requests for update using (true) with check (true);
create policy "Allow public delete ojt id requests" on public.ojt_id_requests for delete using (true);
