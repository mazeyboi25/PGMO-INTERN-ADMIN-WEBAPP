-- PGMO PATCH 2026-06-30: Admin reset student password support
-- Run this once in Supabase SQL Editor.

alter table public.student_accounts
add column if not exists must_change_password boolean not null default false,
add column if not exists password_reset_at timestamptz,
add column if not exists password_reset_by text,
add column if not exists password_changed_at timestamptz;

create index if not exists idx_student_accounts_must_change_password
on public.student_accounts(must_change_password);
