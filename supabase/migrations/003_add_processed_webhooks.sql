-- ────────────────────────────────────────────────────────────
-- 7. Processed webhooks (idempotency ledger)
-- ────────────────────────────────────────────────────────────
-- Tracks event_ids we have already handled so duplicate deliveries
-- from Didit retries are silently ignored.

create table processed_webhooks (
  event_id    uuid primary key,
  session_id  uuid,
  status      text,
  webhook_type text,
  handled_at  timestamptz not null default now()
);

-- Fast lookup by event_id (primary key already indexed).
-- Add a secondary composite index for the alternative dedup key.
create index idx_pw_session_status_type
  on processed_webhooks (session_id, status, webhook_type);

-- Automatically drop rows older than 7 days to keep the table small.
-- Uses the pg_cron extension if available; otherwise a manual sweep
-- works fine for low-volume webhook traffic.
-- NOTE: requires the pg_cron extension (supabase extensions enable pg_cron).
-- If pg_cron is not enabled you can skip this and rely on occasional
-- manual cleanup — the table is append-only and tiny.
-- select cron.schedule('cleanup-processed-webhooks', '0 3 * * *',
--   $$ delete from processed_webhooks where handled_at < now() - interval '7 days'; $$ );
