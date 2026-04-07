-- Downtime risk: NONE — safe for zero-downtime deployment
-- Stores client IDs selected for removal during a plan downgrade.
-- Records are created before the plan change and cleaned up after
-- the clients are deleted on successful downgrade.
create table if not exists pending_downgrade (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  target_tier text not null,
  client_ids uuid[] not null,
  created_at timestamptz not null default now()
);

-- Only one pending downgrade per org at a time
create unique index pending_downgrade_org_id_idx on pending_downgrade(org_id);

-- RLS: service_role only (accessed via admin client)
alter table pending_downgrade enable row level security;
