-- Prevent the nightly sync's writeback from bumping updated_at.
-- The sync sets airtable_record_id + last_synced_at on each synced row. If
-- updated_at were bumped by that write, the row would always look "changed"
-- (updated_at > last_synced_at) and re-sync on every run. So: only bump
-- updated_at when an actual user-facing field changed.

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  if (new.last_synced_at    is distinct from old.last_synced_at
      or new.airtable_record_id is distinct from old.airtable_record_id)
     and new.description is not distinct from old.description
     and new.tags        is not distinct from old.tags
     and new.billable    is not distinct from old.billable
     and new.start_at     is not distinct from old.start_at
     and new.stop_at      is not distinct from old.stop_at
     and new.locked       is not distinct from old.locked
     and new.deleted_at   is not distinct from old.deleted_at then
    -- sync-bookkeeping-only write → keep updated_at as-is
    return new;
  end if;
  new.updated_at = now();
  return new;
end;
$$;
