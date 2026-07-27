-- Adds PAGRO - MOPADC to the Office Assigned options.
-- PAGRO - MOPADC stands for Misamis Oriental Provincial Agricultural Development Complex.

create table if not exists public.office_options (
    office_code text primary key,
    office_name text not null,
    is_active boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

alter table public.office_options enable row level security;

drop policy if exists "Allow public read office options" on public.office_options;
create policy "Allow public read office options"
on public.office_options
for select
using (true);

insert into public.office_options (office_code, office_name, sort_order) values
('PAGRO - MOPADC', 'Misamis Oriental Provincial Agricultural Development Complex', 225)
on conflict (office_code) do update set
    office_name = excluded.office_name,
    sort_order = excluded.sort_order,
    is_active = true;

alter table public.student_accounts
add column if not exists office_assigned text not null default 'Not assigned';
