-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ Interplay Time Tracker — initial schema                            ║
-- ║ The app DB is the source of truth; Airtable is a downstream mirror ║
-- ║ fed by the daily edge function. Payroll/approval stays in Airtable.║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ── staff ────────────────────────────────────────────────────────────
-- Doubles as the APPROVED-EMAIL ALLOW-LIST. Login email may be a personal
-- Gmail OR a company address — whatever the person actually signs in with.
create table public.staff (
  id                   uuid primary key default gen_random_uuid(),
  email                text not null unique,
  full_name            text not null,
  role                 text not null default 'employee' check (role in ('employee','admin')),
  airtable_staff_id    text,            -- linked Airtable Staff record id (Person link)
  interplay_bucks_rate numeric,         -- cached from Airtable; stamped onto entries at push
  active               boolean not null default true,
  created_at           timestamptz not null default now()
);

create index staff_email_lower_idx on public.staff (lower(email));

-- ── time_entries ─────────────────────────────────────────────────────
create table public.time_entries (
  id                uuid primary key default gen_random_uuid(),
  staff_id          uuid not null references public.staff(id) on delete cascade,
  description       text not null default '',
  tags              text[] not null default '{}',
  billable          boolean not null default true,
  start_at          timestamptz not null,
  stop_at           timestamptz,          -- null while the timer is running
  duration_seconds  integer generated always as (
                      case when stop_at is not null
                        then greatest(0, extract(epoch from (stop_at - start_at))::int)
                        else 0 end
                    ) stored,
  auto_stopped      boolean not null default false,  -- forgotten timer closed at 8h
  locked            boolean not null default false,  -- mirrored back from Airtable
  airtable_record_id text,
  last_synced_at    timestamptz,
  deleted_at        timestamptz,          -- soft delete, so the sync can remove it in Airtable
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index time_entries_staff_idx   on public.time_entries (staff_id, start_at desc);
create index time_entries_sync_idx    on public.time_entries (updated_at) where deleted_at is null;

-- ── updated_at trigger ───────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger time_entries_touch
  before update on public.time_entries
  for each row execute function public.touch_updated_at();

-- ── identity helpers (map the logged-in Google account → staff row) ───
create or replace function public.current_staff_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.staff
  where lower(email) = lower(auth.jwt() ->> 'email') and active
  limit 1;
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff
    where id = public.current_staff_id() and role = 'admin'
  );
$$;

-- An entry is editable only if it is not locked AND within the 14-day window.
create or replace function public.entry_editable(p_start timestamptz, p_locked boolean)
returns boolean language sql immutable as $$
  select (not p_locked) and (p_start > now() - interval '14 days');
$$;

-- ── Row Level Security ───────────────────────────────────────────────
alter table public.staff        enable row level security;
alter table public.time_entries enable row level security;

-- staff: read your own row; admins read everyone. No client writes
-- (staff/allow-list is managed by admins out-of-band / service role).
create policy staff_select on public.staff
  for select using (id = public.current_staff_id() or public.is_admin());

-- time_entries: you see your own; admins see all.
create policy entries_select on public.time_entries
  for select using (
    deleted_at is null and (staff_id = public.current_staff_id() or public.is_admin())
  );

-- create only for yourself
create policy entries_insert on public.time_entries
  for insert with check (staff_id = public.current_staff_id());

-- edit only your own, only while editable (not locked, within 14 days)
create policy entries_update on public.time_entries
  for update using (
    staff_id = public.current_staff_id()
    and public.entry_editable(start_at, locked)
  ) with check (
    staff_id = public.current_staff_id()
  );

-- NOTE: deletes are soft (set deleted_at) via the update policy above, so the
-- nightly sync can remove the matching Airtable row before it is purged.

-- ── seeding ──────────────────────────────────────────────────────────
-- Add real people to the allow-list, e.g. (run as service role / SQL editor):
--   insert into public.staff (email, full_name, role, airtable_staff_id)
--   values ('peter@example.com', 'Peter', 'admin', 'recXXXXXXXXXXXXXX');
