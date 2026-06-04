# Backend — Supabase (database) + Vercel cron (sync)

The app database (source of truth) lives in Supabase. The nightly push to
Airtable is a **Vercel Cron** that runs the serverless route
[`../app/api/sync-to-airtable.js`](../app/api/sync-to-airtable.js) — see
`../app/vercel.json`. Payroll/approval stays in Airtable; this just captures
time and feeds it over. See `../DESIGN.md`.

## Database setup

- `migrations/0001_init.sql` — schema, the approved-email allow-list (`staff`),
  `time_entries`, and Row Level Security (each person sees only their own data).
- `migrations/0002_sync_writeback_trigger.sql` — makes the sync's
  `last_synced_at` writeback **not** bump `updated_at` (prevents an endless
  re-sync loop). Run this once in the SQL editor.

Add people to the allow-list (one row per hourly/contractor person), using the
exact email they sign in with (personal Gmail is fine):

```sql
insert into public.staff (email, full_name, role, airtable_staff_id, interplay_bucks_rate)
values ('person@gmail.com', 'Their Name', 'employee', 'recXXXXXXXXXXXXXX', 1.0);
```

## Nightly Airtable sync (Vercel)

The sync runs in the Vercel app, not in Supabase. It:
1. maps each Supabase `staff` row to its Airtable Staff record (joined on email),
2. pulls `time_entries` changed since the last sync,
3. upserts them into Airtable **Time Entries**, merging on the
   **Hourglass Entry ID** field so re-runs never duplicate,
4. writes `airtable_record_id` + `last_synced_at` back to Supabase.

**Env vars (set in Vercel → Project → Settings → Environment Variables):**

| Name | Value |
|---|---|
| `AIRTABLE_API_KEY` | a personal access token with `data.records:read` + `data.records:write` on base `appONwRwGnRvhPgHc` |
| `AIRTABLE_BASE_ID` | `appONwRwGnRvhPgHc` |
| `AIRTABLE_TIME_ENTRIES_TABLE` | `tbl5FWab23bnhepB4` |
| `AIRTABLE_STAFF_TABLE` | `tblG0Wg94I837qbiT` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** (secret, server-only) |
| `CRON_SECRET` | let Vercel generate it; the route rejects callers without `Authorization: Bearer <CRON_SECRET>` |

(`SUPABASE_URL` falls back to the existing `VITE_SUPABASE_URL`.)

**Schedule:** `0 7 * * *` (07:00 UTC ≈ 11 PM PT) in `../app/vercel.json`.

**Manual test:** open `https://<your-app>/api/sync-to-airtable?secret=<CRON_SECRET>`
— it returns a JSON summary `{ pulled, upserted, skipped_no_staff, skipped_deleted, errors }`.

## Airtable field contract

Field IDs are in `../app/api/sync-to-airtable.js` and documented in `../DESIGN.md §3`.
Upsert merges on **Hourglass Entry ID** (`fldSQhZv3NtqSILop`).
