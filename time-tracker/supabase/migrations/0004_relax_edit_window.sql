-- Fix: editing an entry older than 14 days silently failed (the update RLS
-- policy required start_at within 14 days, so the UPDATE matched 0 rows).
-- The `locked` flag (mirrored from Airtable when a pay period is finalized)
-- already protects payroll, so drop the hard 14-day window — staff can edit
-- any of their own entries that aren't locked.

drop policy if exists entries_update on public.time_entries;

create policy entries_update on public.time_entries
  for update using (
    staff_id = public.current_staff_id() and not locked
  ) with check (
    staff_id = public.current_staff_id()
  );
