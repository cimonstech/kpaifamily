-- Audit log table expected by src/lib/db/audit.ts (logEvent) and
-- src/app/admin/audit/page.tsx. Inserts/reads go through the service-role
-- key, so RLS is enabled with no policies to block anon/authenticated access.
--
-- Run in the Supabase SQL editor (or psql against the project database).

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_id uuid,
  actor_role text,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;
