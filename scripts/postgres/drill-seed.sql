-- Synthetic seed for the Postgres restore drill (scripts/postgres/drill.sh).
-- Mirrors the *shape* of the data we care about (subscriptions, plan metadata,
-- indexer cursor, access cache) without any real user data.

create table plans (
  id serial primary key,
  chain_plan_id bigint not null unique,
  creator_address text not null,
  asset text not null,
  amount numeric(39, 0) not null,
  interval_seconds bigint not null
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  fan_address text not null,
  creator_address text not null,
  plan_id integer not null references plans(id),
  status text not null,
  expires_at timestamptz not null
);

create table indexer_cursor (
  id text primary key,
  last_ledger bigint not null,
  updated_at timestamptz not null default now()
);

create table content_access_cache (
  fan_address text not null,
  creator_address text not null,
  has_access boolean not null,
  checked_at timestamptz not null default now(),
  primary key (fan_address, creator_address)
);

insert into plans (chain_plan_id, creator_address, asset, amount, interval_seconds)
select g, 'GCREATOR' || lpad(g::text, 48, '0'), 'native', 10000000 * g, 2592000
from generate_series(1, 50) g;

insert into subscriptions (fan_address, creator_address, plan_id, status, expires_at)
select 'GFAN' || lpad(g::text, 52, '0'),
       'GCREATOR' || lpad(((g % 50) + 1)::text, 48, '0'),
       (g % 50) + 1,
       case when g % 7 = 0 then 'CANCELLED' else 'ACTIVE' end,
       now() + (g || ' hours')::interval
from generate_series(1, 5000) g;

insert into indexer_cursor (id, last_ledger) values ('subscription-events', 1234567);

insert into content_access_cache (fan_address, creator_address, has_access)
select fan_address, creator_address, status = 'ACTIVE' from subscriptions
on conflict do nothing;
