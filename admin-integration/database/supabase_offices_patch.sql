-- PGMO / InternTrack office list patch.
-- Optional helper table for the expanded Office Assigned dropdown.
-- The system still stores office_assigned as text in student_accounts.

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
('Not assigned','Not assigned',0),
('COA-MISOR','Commission on Audit - Misamis Oriental',10),
('CSC-MISOR','CSC - Misamis Oriental Field Office',20),
('HRMO','Human Resources Management Office',30),
('IPCAC','Integrated Provincial Community Assistance Center',40),
('IKNB','Iskolar Ko Ng Bayan Department',50),
('MISORCARES','Misamis Oriental Care System Department',60),
('MISOSC','Misamis Oriental Integrated Sports Council',70),
('MOPH-BALINGASAG','Misamis Oriental Provincial Hospital - Balingasag',80),
('MOPH-CLAVERIA','Misamis Oriental Provincial Hospital - Claveria',90),
('MOPH-GINGOOG','Misamis Oriental Provincial Hospital - Gingoog',100),
('MOPH-INITAO','Misamis Oriental Provincial Hospital - Initao',110),
('MOPH-MAGSAYSAY','Misamis Oriental Provincial Hospital - Magsaysay',120),
('MOPH-MANTICAO','Misamis Oriental Provincial Hospital - Manticao',130),
('MOPH-TALISAYAN','Misamis Oriental Provincial Hospital - Talisayan',140),
('MOPIAD','Misamis Oriental Provincial Internal Audit Department',150),
('MOPJ','Misamis Oriental Provincial Jail',160),
('PCO-MOTORPOOL','Misamis Oriental Provincial Motorpool',170),
('MOPH-ALUBIJID','OWWA Misamis Oriental Provincial Hospital - Alubijid',180),
('BAC','Procurement Unit',190),
('PAO','Provincial Accountant''s Office',200),
('ADMIN','Provincial Administrator''s Office',210),
('PAGRO','Provincial Agriculturist Office',220),
('PAGRO - MOPADC','Misamis Oriental Provincial Agricultural Development Complex',225),
('PASSO','Provincial Assessor''s Office',230),
('PBO','Provincial Budget Office',240),
('PCB','Provincial Capitol Band',250),
('CAPITOLPARK','Provincial Capitol Clean & Green',260),
('PCSG','Provincial Capitol Security Guard',270),
('PCO','Provincial Cooperative Office',280),
('PDRRMO','Provincial Disaster Risk Reduction Management Office',290),
('ECCD','Provincial Early Childhood Care & Development Office',300),
('PEDIPO','Provincial Economic Development & Investment Promotion Office',310),
('PEO','Provincial Engineer''s Office',320),
('PENRO','Provincial Environment & Natural Resources Office',330),
('PGSO','Provincial General Services Office',340),
('PGO','Provincial Governor''s Office',350),
('PHIO','Provincial Health Insurance Office',360),
('PHO','Provincial Health Office',370),
('PIO','Provincial Information Office',380),
('PLO','Provincial Legal Office',390),
('LIBRARY','Provincial Library',400),
('MIS','Provincial Management Information System',410),
('PPDO','Provincial Planning & Development Office',420),
('PPO','Provincial Population Office',430),
('PSWD','Provincial Social Welfare & Development Office',440),
('PSDO','Provincial Sports Development Office',450),
('TOURISM','Provincial Tourism Office',460),
('PTO','Provincial Treasurer''s Office',470),
('PVO','Provincial Veterinary Office',480),
('PYDO','Provincial Youth Development Office',490),
('PESO','Public Employment Services Office',500),
('RTC','Regional Trial Court - Clerk of Court',510),
('ROD','Register of Deeds',520),
('SP','Sangguniang Panlalawigan',530)
on conflict (office_code) do update set
    office_name = excluded.office_name,
    sort_order = excluded.sort_order,
    is_active = true;

alter table public.student_accounts add column if not exists office_assigned text not null default 'Not assigned';
