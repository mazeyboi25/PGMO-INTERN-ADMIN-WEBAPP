-- PGMO quick fix for secure student registration issues.
-- Run this in Supabase SQL Editor, then run supabase_secure_invite_registration.sql again.

alter table if exists public.student_accounts
add column if not exists school text;

alter table if exists public.registration_invites
add column if not exists school text;
