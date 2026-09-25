# Plan: Automated Zoho CRM → MongoDB Sync (replacing manual CSV upload)

## Context

Today, refreshing the weekly tracker requires a human to: log into Zoho CRM, export a custom "Deals" report as CSV, name it `Weekly-tracker_{date}.csv`, and upload it through the dashboard, which triggers `transform_weekly_data()` in [backend/transformation.py](backend/transformation.py) to aggregate and write into MongoDB. This manual step is the dashboard's main bottleneck — data is only as fresh as the last export, and it depends on someone remembering to do it.

The goal is to replace that manual export/upload with a background job that talks directly to the Zoho CRM API, pulls only Deals that are new or changed since the last sync (via `Modified_Time`), and keeps MongoDB current automatically — 3x/day (6AM, 12PM, 6PM IST) — while feeding the *same* categorization/aggregation logic that already powers the dashboard. The manual CSV upload path stays in place as a fallback/override.

This plan covers **architecture only** — no code changes yet. Once approved, implementation happens on a new branch, **`ZCRM-live-PRJ`**, and only merges to `main` after it's validated end-to-end.

## Confirmed feasible (Zoho CRM API research)

- **COQL Query API** (`POST /crm/{version}/coql`) supports `WHERE Modified_Time > '<timestamp>'`, which naturally captures both updated deals *and* brand-new ones (a new record's creation is itself a modification) — this is the single mechanism that satisfies "if last modified date is greater OR new record id is present."
- Capped at 200 rows per call; paginate via repeated calls (`info.more_records` in the response) up to ~100k rows per query — comfortably enough for a Deals-module delta of a few hundred rows every few hours.
- **Bulk Read API** (async job + ZIP download) would normally be the tool for a one-time full historical backfill. But the confirmed row count (~37,647 deals, see below) fits inside a single paginated COQL job (pages of 200 rows, a few hundred calls), so the simpler COQL path likely covers the initial backfill too — no need for the async Bulk Read job unless deal volume grows much larger later.
- Deleted/trashed deals are **not** reflected via `Modified_Time` — they require a separate `Get Deleted Records` (Recycle Bin) call. Out of scope for v1 unless you confirm you need it; flagging as a known gap.
- OAuth is a "Self Client" (server-to-server) grant — **already set up** in this repo: `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_REFRESH_TOKEN` are already in `.env`, and `get_access_token()` in [backend/transformation.py:44](backend/transformation.py:44) already implements the refresh-token → access-token exchange. The sync job reuses this, not a new auth flow.

## What already exists vs. what's new

**Reuse:**
- Zoho OAuth token refresh (`get_access_token()` in `backend/transformation.py`).
- The categorization/calculation logic already in `transform_weekly_data()` — region mapping, `OPP_Type`, `Weighted Amount`, FY/quarter assignment, `projection - category`, etc. This logic currently runs on a pandas DataFrame; it doesn't need to change, only its *input source* does.
- The ISO-week helper already at `backend/main.py:85-108`.
- The existing per-deal Zoho timeline/audit-date cache pattern (lines 44-227) — same "hit Zoho API, cache in Mongo" shape we're extending to full-record sync.

**New:**
- `zoho_deals_raw` collection — one document per deal, upserted by Zoho `Record Id` (Zoho's `normalize_record_id()` already strips the `zcrm_` prefix — reuse that as the join key). Fields, confirmed directly from the real `df.info()` of the untouched Zoho export (31 columns, 37,647 current rows): `Created Time`, `Stage`, `Closing Date`, `PO Expected Date1`–`5`, `Modified Time` (**the sync watermark field**), `Modified Date(Specific Fields Only)`, `Record Id`, `Market Area`, `Opportunities Name`, `Account Owner`, `OPP Category`, `Type`, `Account Name (Account Name)`, `Amount`, `Order Number`, `econ-Region`, `Order Value`, `Expected Revenue`, `Invoiced-Modified Time`, `Total Invoiced`, `Order  Date`, `Probability (%)`, `DesignWinYear`, `Invoice Date`, `Opportunities Owner`, `Billing Country (Account Name)`, `Market Area-Specialization`. Because the CSV is exported from Zoho untouched, these labels are exactly Zoho's report column names — we still need one metadata lookup to resolve each label to its underlying Zoho **API** field name for use in COQL `SELECT`/`WHERE` clauses (custom fields' display labels and API names commonly differ), but the *scope* (which 31 fields) is already locked in, not an unknown.
- `crm_sync_state` collection — single document holding the last successful sync watermark (`last_synced_at`), with a small backward overlap (e.g. 5 minutes) applied when querying, to tolerate clock skew/eventual consistency.
- `crm_sync_logs` collection — one entry per run: start/end time, records fetched, new vs. updated counts, errors, duration — same spirit as the existing `ai_chat_logs` latency tracking per GEMINI.md conventions.
- An in-process **APScheduler** instance started from `main.py`, running three fixed-time jobs (6AM/12PM/6PM IST) plus a manual "run sync now" trigger for testing/admin use.
- A one-time field-mapping step: query Zoho's Fields Metadata API (`GET /crm/v8/settings/fields?module=Deals`) to resolve each of the 31 confirmed column labels above to its Zoho API field name.

**Watermark field clarification:** the CSV also contains two other timestamp-looking columns that must **not** be used as the sync watermark — `Modified Date(Specific Fields Only)` (mostly empty; a custom field that appears to track edits to only a subset of business fields) and `Invoiced-Modified Time` (tracks only invoice-related edits). The plain `Modified Time` column is Zoho's real system-level last-modified timestamp and updates on any field change — that's the one and only field the sync watermark compares against.

## Sync job flow (per run)

1. Read `last_synced_at` from `crm_sync_state`. First-ever run instead does a full backfill: paginated COQL with no time filter, covering all ~37,647 existing deals (no Bulk Read job needed at this volume — see above).
2. Get a fresh Zoho access token via the existing refresh-token flow.
3. Query Deals via COQL: `SELECT <mapped fields> FROM Deals WHERE Modified_Time > '<watermark - 5min>' ORDER BY Modified_Time ASC LIMIT 200`, paginating until exhausted.
4. Upsert each row into `zoho_deals_raw` keyed by `Record Id` — "insert if this Record Id has never been seen, otherwise overwrite its fields." This single upsert step is also how **new deals get picked up**: a brand-new deal's `Modified Time` is its creation time, so it's returned by the same query as changed deals in step 3, and since its `Record Id` doesn't exist in `zoho_deals_raw` yet, the upsert creates a new document for it. No separate "check for new IDs" logic is needed — one query and one upsert handle both new and changed deals.
5. Advance `crm_sync_state.last_synced_at` to the max `Modified Time` actually observed in this run (skip advancing if zero rows returned).
6. Write a `crm_sync_logs` entry (see Admin UI section below for exactly what it records).
7. Automatically run Transform (below) for the current week, tagging the resulting Transform Logs entry `triggered_by: auto`.

## Weekly deleted-deal cleanup (Saturday 00:00 IST)

A 4th scheduled job, separate from the 6AM/12PM/6PM delta syncs, since deletions are rare (you confirmed deals are normally marked Closed Won/Lost, not deleted) and don't need same-day detection:

1. Get a fresh Zoho access token (same reused flow).
2. Call Zoho's `GET /crm/v8/Deals/deleted?type=all` — a module-scoped endpoint that lists Record Ids deleted from the Deals module (covers both "in recycle bin" and "permanently deleted"), paginating until exhausted.
3. For every returned Record Id that still exists in our `zoho_deals_raw`, **soft-delete** it: set `_deleted_in_zoho: true` and `_deleted_detected_at: <now>` on that document rather than physically removing it — keeps an audit trail of "this deal existed, then was deleted on X date" instead of silently erasing history.
4. Transform's underlying query is updated to always exclude `_deleted_in_zoho: true` documents, so soft-deleted deals stop counting toward the aggregated numbers.
5. Automatically run Transform for the current week afterward, so the dashboard reflects the removal immediately rather than waiting for Monday's first sync.
6. Logged as a row in the same `crm_sync_logs` table (adding one field, `run_type`: `"delta_sync"` for the regular 3x/day runs vs. `"deleted_cleanup"` for this one) — so it shows up in the same Sync History table you already asked for, rather than needing a 4th table.

Because `weekly_tracker_data`/`orderbacklogs` only ever get overwritten for the **current** week (past weeks are frozen snapshots, as established earlier), this cleanup naturally only affects the current week's numbers — it doesn't rewrite historical weeks that already went out on slides.

Transform is also independently available as an on-demand button, so a person can force a re-run (tagged `triggered_by: manual`) any time without waiting for the next scheduled sync — e.g. to re-pull the same week after fixing something in Zoho.

## Manual CSV fallback — how it interacts with the automatic sync

The fallback upload isn't just a one-off override that gets forgotten — it has to leave the automatic sync in a consistent state, so it also needs to:
1. Upsert every row of the uploaded CSV into `zoho_deals_raw` keyed by `Record Id`, the same way an API sync would (the CSV already has one row per deal with a `Record Id` and a `Modified Time`, so this is a direct mapping).
2. Set `crm_sync_state.last_synced_at` to the **maximum `Modified Time` value found among the uploaded CSV's own rows** — **not** the wall-clock time you clicked upload. This matters: if the report was exported some time before you got around to uploading it, and a deal changed in Zoho during that gap, stamping the watermark as "upload time" would tell the next auto-sync "nothing before this moment matters," permanently skipping that change. Using the CSV's own latest `Modified Time` instead means the next sync correctly picks up anything that happened after the export, whenever it was actually taken.

## Admin UI: CRM Upload / Weekly Tracker page changes

Today, the "Weekly Tracker" tab under CRM Upload shows one table — **Upload Logs** (manual CSV uploads), backed by the `upload_logs` collection and `GET /api/admin/upload-logs` in [backend/routers/admin.py:221](backend/routers/admin.py:221). That table stays as-is. We add two more tables alongside it, plus two buttons:

**Buttons:**
- **"Resync now"** — manually triggers the same sync job the scheduler runs, immediately, outside the 6AM/12PM/6PM cadence. Useful for testing and for "I just fixed something in Zoho, don't want to wait." Per the decision below, this also auto-runs Transform right after.
- **"Transform"** — manually (re-)runs just the transform step (raw `zoho_deals_raw` → aggregated `weekly_tracker_data`/`orderbacklogs` → slides) for the current week, independent of sync. For forcing a re-run without doing a fresh sync first.

Both buttons capture "who clicked this" using the same pattern already used elsewhere in `admin.py` (e.g. line 1451) — `get_optional_current_user(authorization)`, which resolves the logged-in admin from `admin_sessions`/`admin_users` via the existing auth system. No new auth work needed, just reusing it.

**Table 2 — Sync Logs** (new `crm_sync_logs` collection): one row per sync run —
`started_at`, `ended_at`, `status` (running / completed / failed), `records_scanned`, `new_records`, `updated_records`, `trigger_type` (`auto` or `manual`), `triggered_by` (admin user's identity when `manual`, `null`/"system" when `auto`), `error_message` (if failed).

**Table 3 — Transform Logs** (new `crm_transform_logs` collection): one row per transform run —
`transformed_at`, `status` (completed / failed), `triggered_by` (`auto` when it ran automatically right after a sync, or the admin user's identity when someone clicked the Transform button manually), `week` (which week's snapshot this affected), `error_message` (if failed).

### Decision: transform runs both automatically (after every sync) and on demand

Final decision, per your last message: **transform runs automatically right after every sync completes** (scheduled or manual resync), *and* the manual "Transform" button stays available for on-demand re-runs. The Transform Logs table just needs the one `triggered_by` column (`auto` vs `manual`) to tell them apart — no separate confirm-and-replace dialog needed, since transform now runs routinely as part of the normal flow rather than being a rare, deliberate override.

(Worth knowing as a tradeoff, not a blocker: since transform now runs automatically 3x/day, the current week's numbers on the dashboard will actually update during the day as Zoho data changes, rather than staying fixed until someone deliberately clicks a button. If that turns out to be disruptive for people actively reviewing slides, revisiting this — e.g. adding the confirm dialog back for the auto path too, or pausing auto-transform during a review window — is a small follow-up, not a rework.)

### UI redesign for these tables

I looked at the current implementation — [frontend/src/components/CrmDataUpload.tsx:1032-1116](frontend/src/components/CrmDataUpload.tsx:1032). The existing Uploads Log table is a bare HTML `<table>` with inline styles, no status indication, no pagination, and a single flat list — fine for occasional manual uploads (a handful of rows), but not for Sync Logs, which will accumulate ~3 rows/day (~1,000+/year). Redesign direction:
- **Sub-tabs** for the three tables ("Uploads", "Sync History", "Transform History") instead of stacking three full tables on the page at once.
- **Status pills** (colored badge, not plain text) for `completed` / `failed` / `running` — green / red / amber, reused across Sync and Transform tables.
- **Auto/Manual badge** — small icon + label (e.g. a clock icon for auto, a person icon for manual), with the admin's name shown on hover/tooltip for manual entries.
- **Relative timestamps** ("2 hours ago") with the exact date/time on hover, instead of raw date strings.
- **Pagination** ("most recent 20, load more") for Sync/Transform history, since the Uploads-style "show everything" approach won't scale to daily auto-sync rows.
- **Inline error preview** — failed runs show a truncated error message directly in the row, expandable on click, instead of requiring a separate log lookup.
- Keep the existing color palette/spacing conventions already used elsewhere in this component (`#374151` headers, `#1f2937` text, `#ef4444`/`#10b981` for error/success) so it stays visually consistent with the rest of the admin page, just componentized (a shared `StatusPill` / `LogTable` component) instead of copy-pasted inline styles.

## Open items to nail down during implementation (not blocking the plan, but flagging now)

- **Field mapping (labels confirmed, API names still to resolve)**: the 31 column labels are locked in from the real `df.info()` above; the remaining work is a one-time lookup of each label's underlying Zoho API field name via the Fields Metadata endpoint.
- **APScheduler caveat you accepted**: since the sync runs in-process inside `py main.py`, a sync is skipped if the backend isn't running at trigger time (no catch-up). If that becomes a problem later, an OS-level scheduler (Windows Task Scheduler) calling a standalone script is the fallback design.

## Suggested build order

This plan is meant to be handed to a fresh session with no memory of how we arrived at it — everything needed to execute should be above. Suggested order:

1. `git checkout -b ZCRM-live-PRJ` — all work happens on this branch; do not touch `main` directly.
2. Add `apscheduler` to `requirements.txt` (not currently a dependency).
3. One-time discovery: call Zoho's Fields Metadata API for the Deals module, map the 31 confirmed CSV column labels to their Zoho API field names, and record that mapping in code (e.g. a small constant dict) for reuse in both the COQL queries and the field-mapping open item.
4. Add the new MongoDB collections/state: `zoho_deals_raw`, `crm_sync_state`, `crm_sync_logs` (with a `run_type` field distinguishing `delta_sync` from `deleted_cleanup`), `crm_transform_logs`.
5. Build the sync function (COQL query, pagination, upsert into `zoho_deals_raw`, watermark advance, `crm_sync_logs` write) as a standalone, callable function — not tied to the scheduler yet, so it can be tested directly first.
6. Build the Transform function: adapt the existing aggregation logic in `transform_weekly_data()` (`backend/transformation.py`) to read from `zoho_deals_raw` (excluding `_deleted_in_zoho: true` documents) instead of an uploaded CSV, writing into the current ISO week's `weekly_tracker_data`/`orderbacklogs`, and logging to `crm_transform_logs`.
7. Wire the sync function to call the Transform function automatically on success (`triggered_by: auto`).
8. Build the weekly deleted-deal cleanup function (Zoho deleted-records call, soft-delete flag, auto-Transform afterward, logged with `run_type: deleted_cleanup`).
9. Register all 4 APScheduler jobs in `main.py` on startup: 6AM/12PM/6PM IST delta syncs, Saturday 00:00 IST cleanup.
10. Add admin endpoints: `POST /api/admin/crm-sync/run` (manual resync, `trigger_type: manual`, captures caller via `get_optional_current_user`), `POST /api/admin/crm-transform/run` (manual transform), plus `GET` endpoints for the new Sync/Transform log tables.
11. Update the manual CSV upload path (`admin.py`'s existing weekly upload handler) to also upsert into `zoho_deals_raw` and set `crm_sync_state.last_synced_at` to the CSV's own max `Modified Time`, per the fallback section above.
12. Frontend: add the "Resync now" / "Transform" buttons and the Sync History / Transform History sub-tabs to `CrmDataUpload.tsx`, per the UI redesign direction above.
13. Work through the Verification checklist below end-to-end before considering a merge to `main`.

## Verification (once implemented)

- Click "Resync now" and confirm a Sync Logs row appears with `trigger_type: manual` and the correct `triggered_by`, and `zoho_deals_raw` document counts increase correctly.
- Confirm the 6AM/12PM/6PM scheduled runs also produce Sync Logs rows, with `trigger_type: auto` and `triggered_by: null`/"system".
- Manually edit a test deal's Amount/Stage in Zoho, trigger a sync, and confirm it lands in `zoho_deals_raw` correctly.
- Confirm every sync (auto or manual) is immediately followed by a Transform run, and `weekly_tracker_data`/`orderbacklogs` for the current week reflect the edited deal, with a Transform Logs row showing `triggered_by: auto`.
- Click "Transform" manually and confirm a second Transform Logs row appears for the same week with `triggered_by: manual` and the correct admin identity.
- Confirm a brand-new deal created in Zoho appears in `zoho_deals_raw` after a sync, and shows up in the dashboard numbers automatically once that sync's auto-transform runs.
- Confirm the manual CSV upload path still works as a fallback, correctly seeds `zoho_deals_raw`, and sets `crm_sync_state.last_synced_at` to the max `Modified Time` in the uploaded file (not the upload timestamp) — then confirm the next auto-sync picks up cleanly from that point.
- Delete a test deal in Zoho, run the Saturday cleanup job manually, and confirm it's marked `_deleted_in_zoho` in `zoho_deals_raw`, excluded from the next Transform's aggregation, and logged in Sync History with `run_type: deleted_cleanup`.
