-- Run this once in Supabase's SQL Editor (Dashboard → SQL Editor → New query)
-- to create the table this app needs. After running it, the app will
-- automatically use it via the SUPABASE_URL / SUPABASE_KEY environment
-- variables — no other setup needed.

create table if not exists items (
  id text primary key,
  title text not null,
  link text not null,
  pub_date timestamptz not null,
  tag text,
  category text,
  source text,
  subreddit text,
  is_comment boolean default false,
  status text not null default 'pending',  -- pending | approved | rejected | expired
  fetched_at timestamptz default now(),
  approved_at timestamptz,
  approved_order integer,                   -- position in the approved list; lower = earlier/lead
  breaking boolean default false
);

-- Speeds up the most common queries (filtering by status, ordering approved items)
create index if not exists idx_items_status on items (status);
create index if not exists idx_items_approved_order on items (approved_order);

-- Row Level Security: enabled with a permissive policy since this app
-- uses a single secret key from the server, not per-user auth. If you
-- ever add a public-facing API key (not just this server's), tighten
-- this policy.
alter table items enable row level security;

create policy "Allow all access with service key"
  on items
  for all
  using (true)
  with check (true);
