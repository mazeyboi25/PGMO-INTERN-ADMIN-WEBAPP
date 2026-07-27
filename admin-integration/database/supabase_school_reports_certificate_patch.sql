-- PGMO PATCH: School field for student profile, reports, students, and certificate template.
-- Run this in Supabase SQL Editor before testing the updated ZIP.

alter table if exists public.student_accounts
add column if not exists school text;

comment on column public.student_accounts.school is 'School or university entered by the student and shown in admin reports/certificates.';

-- Updated admin save RPC with school support.
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
            student_id, last_name, first_name, middle_initial, full_name, school, course,
            office_assigned, email, phone, contact_number, status, ojt_status,
            completed_hours, required_hours, supervisor, password_hash, created_at, updated_at
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
