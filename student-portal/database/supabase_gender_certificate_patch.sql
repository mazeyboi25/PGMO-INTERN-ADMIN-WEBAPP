-- PGMO PATCH 2026-07-02: gender for student profile and certificate pronouns.
-- Run this in Supabase SQL Editor before using the new gender field.

alter table if exists public.student_accounts
add column if not exists gender text;

comment on column public.student_accounts.gender is 'Student gender used for profile display and certificate pronoun defaults: Male = his, Female = her.';

-- Optional cleanup for existing mixed-case values.
update public.student_accounts
set gender = case
    when lower(coalesce(gender, '')) in ('m', 'male') then 'Male'
    when lower(coalesce(gender, '')) in ('f', 'female') then 'Female'
    else nullif(trim(coalesce(gender, '')), '')
end
where gender is not null;
