-- Name field update.
-- Student names are stored separately and displayed as LASTNAME, First Name MI.

alter table public.student_accounts
add column if not exists last_name text;

alter table public.student_accounts
add column if not exists first_name text;

alter table public.student_accounts
add column if not exists middle_initial text;
