-- PGMO secure invite-only student registration patch.
-- Updated version: one code per student. Admin enters last name for verification, but generated codes do not reveal the last name.
-- Hashing no longer uses pgcrypto.digest() so it works on Supabase projects where digest() is unavailable in the public search path.
-- Run this in Supabase SQL Editor before testing the updated secure registration page.

create extension if not exists pgcrypto;

alter table if exists public.student_accounts add column if not exists school text;

create table if not exists public.registration_invites (
    id uuid primary key default gen_random_uuid(),
    student_id text,
    full_name text,
    last_name text,
    first_name text,
    middle_initial text,
    email text,
    course text,
    office_assigned text default 'Not assigned',
    contact_number text,
    school text,
    registration_code_hash text not null,
    status text not null default 'unused'
        check (status in ('unused', 'used', 'expired', 'revoked')),
    attempts int not null default 0,
    max_attempts int not null default 3,
    expires_at timestamptz not null default now() + interval '1 hour',
    used_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- These ALTER statements make older installs compatible with the new flexible invite flow.
alter table public.registration_invites alter column student_id drop not null;
alter table public.registration_invites alter column email drop not null;
alter table public.registration_invites drop constraint if exists registration_invites_student_id_key;

alter table public.registration_invites add column if not exists used_by_student_account_id uuid;
alter table public.registration_invites add column if not exists school text;
alter table public.registration_invites alter column max_attempts set default 3;
-- remove comment when enabling expiry: alter table public.registration_invites alter column expires_at set default now() + interval '1 hour';
alter table public.registration_invites alter column expires_at set default '2099-12-31 23:59:59+00'::timestamptz;
update public.registration_invites
set max_attempts = 3
where max_attempts <> 3;
-- update public.registration_invites
-- set expires_at = least(expires_at, created_at + interval '1 hour')
-- where status = 'unused';
-- REMOVE COMMENT WHEN ENABLING EXPIRY, COMMENT OUT THE FOLLOWING LINES: (50-52)
update public.registration_invites
set expires_at = '2099-12-31 23:59:59+00'::timestamptz
where status = 'unused';

alter table public.registration_invites enable row level security;

-- Do not allow the browser to directly read or write invite rows.
drop policy if exists "Allow public read registration invites" on public.registration_invites;
drop policy if exists "Allow public insert registration invites" on public.registration_invites;
drop policy if exists "Allow public update registration invites" on public.registration_invites;
drop policy if exists "Allow public delete registration invites" on public.registration_invites;

-- Stop open/public student account creation. Students must use secure_register_student().
drop policy if exists "Allow public student account registration" on public.student_accounts;

create or replace function public.pgmo_normalize_registration_code(code text)
returns text
language sql
immutable
as $$
    select regexp_replace(upper(coalesce(code, '')), '[^A-Z0-9]', '', 'g');
$$;

create or replace function public.pgmo_registration_code_hash(code text)
returns text
language sql
immutable
as $$
    -- Uses built-in md5() so registration code validation does not depend on pgcrypto.digest().
    -- The raw registration code is still never stored.
    select md5(public.pgmo_normalize_registration_code(code) || ':pgmo-secure-registration-v2');
$$;

create or replace function public.pgmo_format_student_name(last_name text, first_name text, middle_initial text)
returns text
language sql
stable
as $$
    select trim(
        concat(
            nullif(upper(coalesce(last_name, '')), ''),
            case when nullif(trim(coalesce(first_name, '')), '') is not null then ', ' || initcap(trim(first_name)) else '' end,
            case when nullif(trim(coalesce(middle_initial, '')), '') is not null then ' ' || upper(left(trim(middle_initial), 1)) || '.' else '' end
        )
    );
$$;

create or replace function public.admin_create_registration_invite(
    p_student_id text,
    p_last_name text,
    p_first_name text,
    p_middle_initial text,
    p_email text,
    p_course text,
    p_office_assigned text,
    p_contact_number text,
    p_registration_code text,
    p_expires_days int default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_student_id text := upper(trim(coalesce(p_student_id, '')));
    v_email text := lower(trim(coalesce(p_email, '')));
    v_last_name text := upper(trim(coalesce(p_last_name, '')));
    v_code text := public.pgmo_normalize_registration_code(p_registration_code);
    v_full_name text := public.pgmo_format_student_name(v_last_name, p_first_name, p_middle_initial);
    v_existing_account uuid;
begin
    if v_code = '' then
        return jsonb_build_object('ok', false, 'message', 'Registration code is required.');
    end if;

    if v_last_name = '' then
        return jsonb_build_object('ok', false, 'message', 'Last name is required to create a registration code.');
    end if;

    if v_student_id <> '' or v_email <> '' then
        select id into v_existing_account
        from public.student_accounts
        where (v_student_id <> '' and upper(student_id) = v_student_id)
           or (v_email <> '' and lower(email) = v_email)
        limit 1;

        if v_existing_account is not null then
            return jsonb_build_object('ok', false, 'message', 'This student already has an account.');
        end if;
    end if;

    insert into public.registration_invites (
        student_id,
        full_name,
        last_name,
        first_name,
        middle_initial,
        email,
        course,
        office_assigned,
        contact_number,
        registration_code_hash,
        status,
        attempts,
        max_attempts,
        expires_at,
        used_at,
        updated_at
    ) values (
        nullif(v_student_id, ''),
        nullif(v_full_name, ''),
        nullif(v_last_name, ''),
        nullif(trim(coalesce(p_first_name, '')), ''),
        nullif(upper(left(trim(coalesce(p_middle_initial, '')), 1)), ''),
        nullif(v_email, ''),
        nullif(trim(coalesce(p_course, '')), ''),
        coalesce(nullif(trim(p_office_assigned), ''), 'Not assigned'),
        nullif(trim(coalesce(p_contact_number, '')), ''),
        public.pgmo_registration_code_hash(v_code),
        'unused',
        0,
        3,
        '2099-12-31 23:59:59+00'::timestamptz, -- remove comment when enabling expiry
    --    now() + interval '1 hour',
        null,
        now()
    );

    return jsonb_build_object('ok', true, 'message', 'Registration invite created.');
end;
$$;

create or replace function public.admin_list_registration_invites()
returns table (
    id uuid,
    student_id text,
    full_name text,
    last_name text,
    first_name text,
    middle_initial text,
    email text,
    course text,
    office_assigned text,
    contact_number text,
    status text,
    attempts int,
    max_attempts int,
    expires_at timestamptz,
    used_at timestamptz,
    created_at timestamptz,
    used_by_student_account_id uuid,
    used_by_student_id text,
    used_by_last_name text,
    used_by_full_name text,
    used_by_email text
)
language sql
security definer
set search_path = public
as $$
    select
        ri.id,
        ri.student_id,
        ri.full_name,
        ri.last_name,
        ri.first_name,
        ri.middle_initial,
        ri.email,
        ri.course,
        ri.office_assigned,
        ri.contact_number,
--        case
--            when ri.status = 'unused' and ri.expires_at < now() then 'expired'
--            else ri.status
--        end as status,
        ri.status as status, -- remove comment when enabling expiry
        ri.attempts,
        ri.max_attempts,
        ri.expires_at,
        ri.used_at,
        ri.created_at,
        ri.used_by_student_account_id,
        sa.student_id as used_by_student_id,
        sa.last_name as used_by_last_name,
        sa.full_name as used_by_full_name,
        sa.email as used_by_email
    from public.registration_invites ri
    left join public.student_accounts sa
        on sa.id = ri.used_by_student_account_id
    order by ri.created_at desc;
$$;

drop function if exists public.admin_unrevoke_registration_invite(uuid);
drop function if exists public.admin_delete_registration_invite(uuid);

create or replace function public.admin_revoke_registration_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.registration_invites
    set status = 'revoked', updated_at = now()
    where id = p_invite_id and status = 'unused' and used_at is null;

    if not found then
        return jsonb_build_object('ok', false, 'message', 'Invite was not found or can no longer be revoked.');
    end if;

    return jsonb_build_object('ok', true, 'message', 'Invite revoked.');
end;
$$;

create or replace function public.admin_unrevoke_registration_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.registration_invites
    set status = 'unused',
        attempts = 0,
        max_attempts = 3,
        expires_at = now() + interval '1 hour',
        updated_at = now()
    where id = p_invite_id
      and used_at is null
      and (status = 'revoked' or (status = 'unused' and expires_at < now()));

    if not found then
        return jsonb_build_object('ok', false, 'message', 'Only revoked or expired unused invites can be unrevoked. Used invites cannot be reused.');
    end if;

    return jsonb_build_object('ok', true, 'message', 'Invite unrevoked. It is usable again for 1 hour.');
end;
$$;

create or replace function public.admin_delete_registration_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from public.registration_invites
    where id = p_invite_id;

    if not found then
        return jsonb_build_object('ok', false, 'message', 'Invite was not found.');
    end if;

    return jsonb_build_object('ok', true, 'message', 'Registration key deleted.');
end;
$$;

create or replace function public.secure_register_student(
    p_student_id text,
    p_email text,
    p_registration_code text,
    p_last_name text,
    p_first_name text,
    p_middle_initial text,
    p_contact_number text,
    p_course text,
    p_password_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_student_id text := upper(trim(coalesce(p_student_id, '')));
    v_email text := lower(trim(coalesce(p_email, '')));
    v_input_last_name text := upper(trim(coalesce(p_last_name, '')));
    v_code_hash text := public.pgmo_registration_code_hash(p_registration_code);
    v_invite public.registration_invites%rowtype;
    v_existing uuid;
    v_last_name text;
    v_first_name text;
    v_middle_initial text;
    v_full_name text;
    v_course text;
    v_phone text;
    v_office text;
    v_school text;
    v_new_id uuid;
begin
    if v_student_id = '' or v_email = '' or v_input_last_name = '' or p_registration_code is null or trim(p_registration_code) = '' then
        return jsonb_build_object('ok', false, 'message', 'Student ID, last name, email, and registration code are required.');
    end if;

    if p_password_hash is null or length(trim(p_password_hash)) < 20 then
        return jsonb_build_object('ok', false, 'message', 'Password is required.');
    end if;

    select * into v_invite
    from public.registration_invites
    where registration_code_hash = v_code_hash
    limit 1
    for update;

    if not found then
        return jsonb_build_object('ok', false, 'message', 'Registration denied. Your code is not on the approved list.');
    end if;

    if v_invite.status = 'used' then
        return jsonb_build_object('ok', false, 'message', 'This registration code has already been used.');
    end if;

    if v_invite.status = 'revoked' then
        return jsonb_build_object('ok', false, 'message', 'This registration code was revoked. Contact your coordinator.');
    end if;

-- Expiry disabled for now
--    if v_invite.expires_at < now() then
--        update public.registration_invites set status = 'expired', updated_at = now() where id = v_invite.id;
--        return jsonb_build_object('ok', false, 'message', 'This registration code has expired. Contact your coordinator.');
--    end if;

    if v_invite.attempts >= v_invite.max_attempts then
        update public.registration_invites set status = 'revoked', updated_at = now() where id = v_invite.id;
        return jsonb_build_object('ok', false, 'message', 'Too many failed attempts. This code is now locked.');
    end if;

    if (v_invite.student_id is not null and upper(v_invite.student_id) <> v_student_id)
       or (v_invite.email is not null and lower(v_invite.email) <> v_email)
       or (v_invite.last_name is not null and upper(v_invite.last_name) <> v_input_last_name) then
        update public.registration_invites
        set attempts = attempts + 1,
            status = case when attempts + 1 >= max_attempts then 'revoked' else status end,
            updated_at = now()
        where id = v_invite.id;

        return jsonb_build_object('ok', false, 'message', 'Registration denied. Your details do not match the approved registration access.');
    end if;

    select id into v_existing
    from public.student_accounts
    where upper(student_id) = v_student_id or lower(email) = v_email
    limit 1;

    if v_existing is not null then
        update public.registration_invites
        set status = 'used', used_at = now(), used_by_student_account_id = v_existing, updated_at = now()
        where id = v_invite.id;
        return jsonb_build_object('ok', false, 'message', 'This student account is already registered.');
    end if;

    v_last_name := coalesce(nullif(v_invite.last_name, ''), v_input_last_name);
    v_first_name := coalesce(nullif(v_invite.first_name, ''), trim(coalesce(p_first_name, '')));
    v_middle_initial := coalesce(nullif(v_invite.middle_initial, ''), upper(left(trim(coalesce(p_middle_initial, '')), 1)));
    v_full_name := coalesce(nullif(v_invite.full_name, ''), public.pgmo_format_student_name(v_last_name, v_first_name, v_middle_initial));
    v_course := coalesce(nullif(v_invite.course, ''), trim(coalesce(p_course, '')));
    v_phone := coalesce(nullif(trim(coalesce(p_contact_number, '')), ''), v_invite.contact_number, '');
    v_office := coalesce(nullif(v_invite.office_assigned, ''), 'Not assigned');
    -- Keep this blank because the registration page only asks for course, not school.
    -- This also prevents older Supabase registration_invites tables from throwing:
    -- record "v_invite" has no field "school".
    v_school := '';

    insert into public.student_accounts (
        student_id,
        last_name,
        first_name,
        middle_initial,
        full_name,
        school,
        email,
        phone,
        contact_number,
        course,
        office_assigned,
        password_hash,
        status,
        ojt_status,
        completed_hours,
        required_hours,
        created_at,
        updated_at
    ) values (
        v_student_id,
        v_last_name,
        v_first_name,
        v_middle_initial,
        v_full_name,
        v_school,
        v_email,
        v_phone,
        v_phone,
        v_course,
        v_office,
        trim(p_password_hash),
        'Active',
        'Pending',
        0,
        0,
        now(),
        now()
    )
    returning id into v_new_id;

    update public.registration_invites
    set status = 'used', used_at = now(), used_by_student_account_id = v_new_id, updated_at = now()
    where id = v_invite.id;

    return jsonb_build_object('ok', true, 'message', 'Account created successfully.', 'student_account_id', v_new_id, 'verified_last_name', v_last_name);
end;
$$;

create or replace function public.admin_save_student_account(
    p_existing_id uuid,
    p_student_id text,
    p_last_name text,
    p_first_name text,
    p_middle_initial text,
    p_school text,
    p_course text,
    p_office_assigned text,
    p_email text,
    p_phone text,
    p_ojt_status text,
    p_completed_hours numeric,
    p_required_hours numeric,
    p_password_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_student_id text := upper(trim(coalesce(p_student_id, '')));
    v_email text := lower(trim(coalesce(p_email, '')));
    v_full_name text := public.pgmo_format_student_name(p_last_name, p_first_name, p_middle_initial);
    v_id uuid;
begin
    if v_student_id = '' or v_email = '' or trim(coalesce(p_last_name, '')) = '' or trim(coalesce(p_first_name, '')) = '' then
        return jsonb_build_object('ok', false, 'message', 'Student ID, name, and email are required.');
    end if;

    if p_required_hours is null or p_required_hours <= 0 then
        return jsonb_build_object('ok', false, 'message', 'Required hours must be greater than zero.');
    end if;

    if p_existing_id is null then
        if p_password_hash is null or trim(p_password_hash) = '' then
            return jsonb_build_object('ok', false, 'message', 'Temporary password is required for new admin-created accounts.');
        end if;

        insert into public.student_accounts (
            student_id,
            last_name,
            first_name,
            middle_initial,
            full_name,
            school,
            course,
            office_assigned,
            email,
            phone,
            contact_number,
            status,
            ojt_status,
            completed_hours,
            required_hours,
            supervisor,
            password_hash,
            created_at,
            updated_at
        ) values (
            v_student_id,
            upper(trim(coalesce(p_last_name, ''))),
            trim(coalesce(p_first_name, '')),
            upper(left(trim(coalesce(p_middle_initial, '')), 1)),
            v_full_name,
            trim(coalesce(p_school, '')),
            trim(coalesce(p_course, '')),
            coalesce(nullif(trim(p_office_assigned), ''), 'Not assigned'),
            v_email,
            trim(coalesce(p_phone, '')),
            trim(coalesce(p_phone, '')),
            'Active',
            coalesce(nullif(trim(p_ojt_status), ''), 'Pending'),
            coalesce(p_completed_hours, 0),
            coalesce(p_required_hours, 0),
            coalesce(nullif(trim(p_office_assigned), ''), 'Not assigned') || ' Supervisor',
            trim(p_password_hash),
            now(),
            now()
        ) returning id into v_id;
    else
        update public.student_accounts
        set student_id = v_student_id,
            last_name = upper(trim(coalesce(p_last_name, ''))),
            first_name = trim(coalesce(p_first_name, '')),
            middle_initial = upper(left(trim(coalesce(p_middle_initial, '')), 1)),
            full_name = v_full_name,
            school = trim(coalesce(p_school, '')),
            course = trim(coalesce(p_course, '')),
            office_assigned = coalesce(nullif(trim(p_office_assigned), ''), 'Not assigned'),
            email = v_email,
            phone = trim(coalesce(p_phone, '')),
            contact_number = trim(coalesce(p_phone, '')),
            status = 'Active',
            ojt_status = coalesce(nullif(trim(p_ojt_status), ''), 'Pending'),
            completed_hours = coalesce(p_completed_hours, 0),
            required_hours = coalesce(p_required_hours, 0),
            supervisor = coalesce(nullif(trim(p_office_assigned), ''), 'Not assigned') || ' Supervisor',
            password_hash = coalesce(nullif(trim(coalesce(p_password_hash, '')), ''), password_hash),
            updated_at = now()
        where id = p_existing_id
        returning id into v_id;

        if v_id is null then
            return jsonb_build_object('ok', false, 'message', 'Student account not found.');
        end if;
    end if;

    return jsonb_build_object('ok', true, 'message', 'Student saved.', 'student_account_id', v_id);
end;
$$;



-- PGMO PATCH: full student delete cascade for database records.
-- This removes student account records plus all known records tied to the student.
alter table if exists public.registration_invites
add column if not exists used_by_student_account_id uuid;

create or replace function public.admin_delete_student_account(
    p_student_uuid uuid,
    p_student_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_account public.student_accounts%rowtype;
    v_student_id text;
    v_email text;
    v_deleted_uploads int := 0;
    v_deleted_dtr int := 0;
    v_deleted_notifications int := 0;
    v_deleted_id_requests int := 0;
    v_deleted_invites int := 0;
    v_deleted_accounts int := 0;
begin
    select * into v_account
    from public.student_accounts
    where (p_student_uuid is not null and id = p_student_uuid)
       or (p_student_id is not null and upper(student_id) = upper(trim(p_student_id)))
    limit 1;

    if not found then
        return jsonb_build_object('ok', false, 'message', 'Student account not found.');
    end if;

    v_student_id := v_account.student_id;
    v_email := lower(coalesce(v_account.email, ''));

    delete from public.ojt_uploads
    where student_id = v_student_id;
    get diagnostics v_deleted_uploads = row_count;

    delete from public.ojt_dtr_forms
    where student_id = v_student_id
       or student_account_id = v_account.id;
    get diagnostics v_deleted_dtr = row_count;

    delete from public.ojt_notifications
    where student_id = v_student_id;
    get diagnostics v_deleted_notifications = row_count;

    delete from public.ojt_id_requests
    where student_id = v_student_id
       or student_account_id = v_account.id;
    get diagnostics v_deleted_id_requests = row_count;

    delete from public.registration_invites
    where used_by_student_account_id = v_account.id
       or (student_id is not null and upper(student_id) = upper(v_student_id))
       or (email is not null and lower(email) = v_email);
    get diagnostics v_deleted_invites = row_count;

    delete from public.student_accounts
    where id = v_account.id;
    get diagnostics v_deleted_accounts = row_count;

    return jsonb_build_object(
        'ok', true,
        'message', 'Student and all related database records were deleted.',
        'student_id', v_student_id,
        'deleted_uploads', v_deleted_uploads,
        'deleted_dtr', v_deleted_dtr,
        'deleted_notifications', v_deleted_notifications,
        'deleted_id_requests', v_deleted_id_requests,
        'deleted_invites', v_deleted_invites,
        'deleted_accounts', v_deleted_accounts
    );
end;
$$;

grant execute on function public.admin_delete_student_account(uuid, text) to anon, authenticated;


grant execute on function public.admin_create_registration_invite(text,text,text,text,text,text,text,text,text,int) to anon, authenticated;
grant execute on function public.admin_list_registration_invites() to anon, authenticated;
grant execute on function public.admin_revoke_registration_invite(uuid) to anon, authenticated;
grant execute on function public.admin_unrevoke_registration_invite(uuid) to anon, authenticated;
grant execute on function public.admin_delete_registration_invite(uuid) to anon, authenticated;
grant execute on function public.secure_register_student(text,text,text,text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.admin_save_student_account(uuid,text,text,text,text,text,text,text,text,text,text,numeric,numeric,text) to anon, authenticated;



-- PGMO PATCH: Keep admin-entered completed hours as baseline/manual hours.
-- This prevents approved DTR recalculation from wiping out hours edited by the admin.
-- Run this in Supabase SQL Editor.

alter table if exists public.student_accounts
add column if not exists manual_completed_hours numeric default 0;

comment on column public.student_accounts.manual_completed_hours is
'Admin-entered baseline completed hours. Approved DTR hours are added on top of this value.';

-- Seed manual hours for existing accounts where the column is still empty/zero.
-- This preserves the current completed_hours as the baseline before future DTR approvals.
update public.student_accounts
set manual_completed_hours = coalesce(completed_hours, 0)
where coalesce(manual_completed_hours, 0) = 0
  and coalesce(completed_hours, 0) > 0;

create or replace function public.admin_save_student_account(
    p_existing_id uuid,
    p_student_id text,
    p_last_name text,
    p_first_name text,
    p_middle_initial text,
    p_school text,
    p_course text,
    p_office_assigned text,
    p_email text,
    p_phone text,
    p_ojt_status text,
    p_completed_hours numeric,
    p_required_hours numeric,
    p_password_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_student_id text := upper(trim(coalesce(p_student_id, '')));
    v_email text := lower(trim(coalesce(p_email, '')));
    v_full_name text := public.pgmo_format_student_name(p_last_name, p_first_name, p_middle_initial);
    v_id uuid;
    v_approved_dtr_hours numeric := 0;
    v_manual_hours numeric := 0;
    v_total_hours numeric := 0;
begin
    if v_student_id = '' or v_email = '' or trim(coalesce(p_last_name, '')) = '' or trim(coalesce(p_first_name, '')) = '' then
        return jsonb_build_object('ok', false, 'message', 'Student ID, name, and email are required.');
    end if;

    if p_required_hours is null or p_required_hours <= 0 then
        return jsonb_build_object('ok', false, 'message', 'Required hours must be greater than zero.');
    end if;

    if to_regclass('public.ojt_dtr_forms') is not null then
        select coalesce(sum(total_hours), 0) into v_approved_dtr_hours
        from public.ojt_dtr_forms
        where upper(student_id) = v_student_id
          and status = 'Approved';
    end if;

    v_manual_hours := greatest(coalesce(p_completed_hours, 0) - coalesce(v_approved_dtr_hours, 0), 0);
    v_total_hours := v_manual_hours + coalesce(v_approved_dtr_hours, 0);

    if p_existing_id is null then
        if p_password_hash is null or trim(p_password_hash) = '' then
            return jsonb_build_object('ok', false, 'message', 'Temporary password is required for new admin-created accounts.');
        end if;

        insert into public.student_accounts (
            student_id, last_name, first_name, middle_initial, full_name, school, course,
            office_assigned, email, phone, contact_number, status, ojt_status,
            manual_completed_hours, completed_hours, required_hours, supervisor, password_hash, created_at, updated_at
        ) values (
            v_student_id,
            upper(trim(coalesce(p_last_name, ''))),
            trim(coalesce(p_first_name, '')),
            upper(left(trim(coalesce(p_middle_initial, '')), 1)),
            v_full_name,
            trim(coalesce(p_school, '')),
            trim(coalesce(p_course, '')),
            coalesce(nullif(trim(p_office_assigned), ''), 'Not assigned'),
            v_email,
            trim(coalesce(p_phone, '')),
            trim(coalesce(p_phone, '')),
            'Active',
            coalesce(nullif(trim(p_ojt_status), ''), 'Pending'),
            v_manual_hours,
            v_total_hours,
            coalesce(p_required_hours, 0),
            coalesce(nullif(trim(p_office_assigned), ''), 'Not assigned') || ' Supervisor',
            trim(p_password_hash),
            now(), now()
        ) returning id into v_id;
    else
        update public.student_accounts
        set student_id = v_student_id,
            last_name = upper(trim(coalesce(p_last_name, ''))),
            first_name = trim(coalesce(p_first_name, '')),
            middle_initial = upper(left(trim(coalesce(p_middle_initial, '')), 1)),
            full_name = v_full_name,
            school = trim(coalesce(p_school, '')),
            course = trim(coalesce(p_course, '')),
            office_assigned = coalesce(nullif(trim(p_office_assigned), ''), 'Not assigned'),
            email = v_email,
            phone = trim(coalesce(p_phone, '')),
            contact_number = trim(coalesce(p_phone, '')),
            status = 'Active',
            ojt_status = coalesce(nullif(trim(p_ojt_status), ''), 'Pending'),
            manual_completed_hours = v_manual_hours,
            completed_hours = v_total_hours,
            required_hours = coalesce(p_required_hours, 0),
            supervisor = coalesce(nullif(trim(p_office_assigned), ''), 'Not assigned') || ' Supervisor',
            password_hash = coalesce(nullif(trim(coalesce(p_password_hash, '')), ''), password_hash),
            updated_at = now()
        where id = p_existing_id
        returning id into v_id;

        if v_id is null then
            return jsonb_build_object('ok', false, 'message', 'Student account not found.');
        end if;
    end if;

    return jsonb_build_object('ok', true, 'message', 'Student saved.', 'student_account_id', v_id);
end;
$$;

grant execute on function public.admin_save_student_account(uuid,text,text,text,text,text,text,text,text,text,text,numeric,numeric,text) to anon, authenticated;


-- PGMO PATCH 2026-06-30: Admin reset student password support
-- Run this once in Supabase SQL Editor.

alter table public.student_accounts
add column if not exists must_change_password boolean not null default false,
add column if not exists password_reset_at timestamptz,
add column if not exists password_reset_by text,
add column if not exists password_changed_at timestamptz;

create index if not exists idx_student_accounts_must_change_password
on public.student_accounts(must_change_password);
