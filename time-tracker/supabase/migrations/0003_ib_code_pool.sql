-- Plan B: pre-staged Ticket Tailor discount-code pool.
-- Briana imports single-use codes (made in TT) once per quarter; Hourglass
-- draws from the pool on each redemption — no TT API at redeem time.

create table public.ib_code_pool (
  code                 text primary key,
  denomination_cents   integer not null,
  status               text not null default 'available' check (status in ('available','assigned','used')),
  assigned_to_staff_id uuid references public.staff(id),
  assigned_at          timestamptz,
  used_at              timestamptz,
  expires_at           date,            -- optional: expiry set in TT, tracked for the email
  imported_at          timestamptz not null default now()
);

create index idx_ib_code_pool_available
  on public.ib_code_pool (denomination_cents, status) where status = 'available';

-- Server-only: routes use the service-role key (bypasses RLS). No client policies.
alter table public.ib_code_pool enable row level security;

-- Atomically claim one available code of a denomination (race-safe).
create or replace function public.claim_ib_code(p_denomination integer, p_staff uuid)
returns public.ib_code_pool
language plpgsql security definer set search_path = public as $$
declare v_code text; v_row public.ib_code_pool;
begin
  select code into v_code from public.ib_code_pool
    where status = 'available' and denomination_cents = p_denomination
    order by imported_at asc
    for update skip locked
    limit 1;
  if v_code is null then return null; end if;
  update public.ib_code_pool
    set status = 'assigned', assigned_to_staff_id = p_staff, assigned_at = now()
    where code = v_code
    returning * into v_row;
  return v_row;
end;
$$;

-- Available count per denomination (for the dashboard picker + low-stock alert).
create or replace function public.ib_pool_stock()
returns table(denomination_cents integer, available bigint)
language sql security definer set search_path = public as $$
  select denomination_cents, count(*)::bigint
  from public.ib_code_pool where status = 'available'
  group by denomination_cents;
$$;

-- Counts per denomination + status (for the admin pool page).
create or replace function public.ib_pool_counts()
returns table(denomination_cents integer, status text, n bigint)
language sql security definer set search_path = public as $$
  select denomination_cents, status, count(*)::bigint
  from public.ib_code_pool group by denomination_cents, status;
$$;

-- Recent import batches (rows share imported_at within one bulk insert).
create or replace function public.ib_pool_recent_imports()
returns table(imported_at timestamptz, n bigint)
language sql security definer set search_path = public as $$
  select imported_at, count(*)::bigint from public.ib_code_pool
  group by imported_at order by imported_at desc limit 10;
$$;
