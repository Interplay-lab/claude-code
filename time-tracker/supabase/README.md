# Backend — Supabase

The app database (source of truth) + the nightly Airtable push. Payroll/approval
stays in Airtable; this just captures time and feeds it over. See `../DESIGN.md`.

## Layout

- `migrations/0001_init.sql` — schema, the approved-email allow-list (`staff`),
  `time_entries`, and Row Level Security (each person sees only their own data).
- `functions/daily-airtable-sync/` — the once-a-day edge function that auto-stops
  forgotten timers, upserts entries into Airtable on **Source Entry ID**,
  propagates deletes, and mirrors Airtable's **Locked** flag back.

## One-time setup

1. **Create a Supabase project**, then run the migration (SQL editor, or
   `supabase db push` with the CLI).
2. **Enable Google auth**: Supabase → Authentication → Providers → Google
   (add the Google OAuth client ID/secret; set the app origin as a redirect URL).
3. **Add people to the allow-list** — for each hourly/contractor person:
   ```sql
   insert into public.staff (email, full_name, role, airtable_staff_id, interplay_bucks_rate)
   values ('person@gmail.com', 'Their Name', 'employee', 'recXXXXXXXXXXXXXX', 1.0);
   ```
   Use the **exact** email they sign in with (personal Gmail is fine). Mark
   admins with `role = 'admin'`. `airtable_staff_id` is their Airtable Staff record id.
4. **Deploy the sync function** and set its secrets:
   ```bash
   supabase functions deploy daily-airtable-sync
   supabase secrets set AIRTABLE_PAT=pat_xxx AIRTABLE_BASE_ID=appXXXX \
     AIRTABLE_TABLE="Time Entries" AIRTABLE_LOCKED_FIELD="Locked"
   ```
   (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)
5. **Schedule it daily** — Supabase → Edge Functions → Schedules (cron, e.g.
   `0 5 * * *`), or via `pg_cron` + `pg_net`. Matches today's once-a-day cadence.
6. **Point the app at the project**: copy `app/.env.example` → `app/.env.local`
   and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Airtable field contract

The function writes the exact fields the retired Make scenario used (field IDs in
`functions/daily-airtable-sync/index.ts`, documented in `../DESIGN.md §3`). Upsert
merges on **Source Entry ID** so re-running never duplicates rows.

## Cutover

Run in parallel with Toggl for one pay period, confirm the Airtable output matches,
then disable the Make scenario (4985926) and the backfill (5035416).
