-- PGMO PATCH 2026-07-06: Admin-selectable gender for student accounts.
-- Run this in Supabase SQL Editor if the Gender dropdown does not save.

alter table if exists public.student_accounts
add column if not exists gender text;

comment on column public.student_accounts.gender is
'Student gender set by the admin in Students Management and used for profile/certificate pronoun defaults.';

update public.student_accounts
set gender = case
    when lower(coalesce(gender, '')) in ('m', 'male') then 'Male'
    when lower(coalesce(gender, '')) in ('f', 'female') then 'Female'
    else nullif(trim(coalesce(gender, '')), '')
end
where gender is not null;
