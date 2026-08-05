-- tiny-proposales schema. Applied with: node --env-file=.env.local <runner>
-- Idempotent so it can be re-run against an existing database.

-- The status set is closed and stable, so it is enforced by the database
-- rather than by convention. `create type` has no `if not exists`.
do $$ begin
  create type proposal_status as enum ('draft', 'sent', 'accepted');
exception when duplicate_object then null;
end $$;

create table if not exists proposals (
  id            uuid primary key default gen_random_uuid(),
  share_token   text unique not null,
  hotel_name    text not null,
  event_name    text not null,
  guest_count   int,
  arrival_date  date,
  nights        int,
  currency      text not null default 'SEK',
  status        proposal_status not null default 'draft',
  version       int  not null default 1,
  created_at    timestamptz not null default now()
);

-- Money is stored in minor units (öre) as an integer. Floats lose money.
create table if not exists line_items (
  id               uuid primary key default gen_random_uuid(),
  proposal_id      uuid not null references proposals(id) on delete cascade,
  position         int  not null default 0,
  label            text not null,
  quantity         int  not null default 1,
  unit_price_minor int  not null
);

-- Line order is commercially meaningful, and uuid primary keys carry no
-- insertion order, so it is stored rather than inferred.
alter table line_items add column if not exists position int not null default 0;

-- Both nullable: an enquiry that states neither is normal, and a guessed
-- arrival date is worse than an absent one.
alter table proposals add column if not exists arrival_date date;
alter table proposals add column if not exists nights int;

-- Who the proposal is FOR. Distinct from hotel_name, which is who it is FROM:
-- an enquiry names the sender's own company and never the hotel it is
-- addressed to, so conflating the two would file every proposal under the
-- buyer's name.
alter table proposals add column if not exists client_name text;

-- Hybrid on purpose. Columns hold what the product reasons about, so the
-- database can enforce it: an enum for status, not-null where it matters, a
-- date that must be a date. This holds what the product merely records - the
-- raw AI extraction, whose shape follows the model schema rather than ours.
-- A new extracted field lands here with no migration; if the product starts
-- making decisions on it, it gets promoted to a column with a constraint.
alter table proposals add column if not exists enquiry jsonb;

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
