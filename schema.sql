-- tiny-proposales schema. Applied with: node --env-file=.env.local <runner>
-- Idempotent so it can be re-run against an existing database.

create table if not exists proposals (
  id            uuid primary key default gen_random_uuid(),
  share_token   text unique not null,
  hotel_name    text not null,
  event_name    text not null,
  guest_count   int,
  currency      text not null default 'SEK',
  status        text not null default 'draft',
  version       int  not null default 1,
  created_at    timestamptz not null default now()
);

-- Money is stored in minor units (öre) as an integer. Floats lose money.
create table if not exists line_items (
  id               uuid primary key default gen_random_uuid(),
  proposal_id      uuid not null references proposals(id) on delete cascade,
  label            text not null,
  quantity         int  not null default 1,
  unit_price_minor int  not null
);

-- proposal_version records which version of the proposal the buyer actually
-- saw and accepted, so a mid-read edit by the seller is detectable.
create table if not exists acceptances (
  id                uuid primary key default gen_random_uuid(),
  proposal_id       uuid not null references proposals(id),
  proposal_version  int  not null,
  signer_email      text,
  signer_ip         text,
  accepted_at       timestamptz not null default now()
);

create index if not exists line_items_proposal_id_idx on line_items (proposal_id);
create index if not exists proposals_created_at_idx   on proposals (created_at desc);
