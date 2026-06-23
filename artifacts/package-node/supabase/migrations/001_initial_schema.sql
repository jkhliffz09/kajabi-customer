create extension if not exists pgcrypto;

create table if not exists public.kajabi_tokens (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'kajabi' unique,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kajabi_customers (
  id uuid primary key default gen_random_uuid(),
  kajabi_customer_id text not null unique,
  name text,
  email text,
  avatar text,
  net_revenue text,
  sign_in_count integer,
  last_request_at timestamptz,
  created_at_kajabi timestamptz,
  updated_at_kajabi timestamptz,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kajabi_offers (
  id uuid primary key default gen_random_uuid(),
  kajabi_offer_id text not null unique,
  title text,
  internal_title text,
  price_in_cents integer,
  currency text,
  payment_type text,
  checkout_url text,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kajabi_products (
  id uuid primary key default gen_random_uuid(),
  kajabi_product_id text not null unique,
  title text,
  internal_title text,
  description text,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kajabi_purchases (
  id uuid primary key default gen_random_uuid(),
  kajabi_purchase_id text not null unique,
  kajabi_customer_id text,
  kajabi_offer_id text,
  customer_email text,
  customer_name text,
  offer_title text,
  amount_in_cents integer,
  currency text,
  payment_type text,
  status text,
  normalized_status text not null default 'unknown',
  active boolean,
  deactivated_at timestamptz,
  deactivation_reason text,
  coupon_code text,
  source text,
  referrer text,
  quantity integer,
  effective_start_at timestamptz,
  kajabi_created_at timestamptz,
  kajabi_updated_at timestamptz,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kajabi_purchase_products (
  kajabi_purchase_id text not null,
  kajabi_product_id text not null,
  created_at timestamptz not null default now(),
  primary key (kajabi_purchase_id, kajabi_product_id)
);

create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  sync_type text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_processed integer not null default 0,
  error_message text,
  raw_response jsonb
);

create index if not exists kajabi_purchases_customer_idx on public.kajabi_purchases(kajabi_customer_id);
create index if not exists kajabi_purchases_offer_idx on public.kajabi_purchases(kajabi_offer_id);
create index if not exists kajabi_purchases_status_idx on public.kajabi_purchases(normalized_status);
create index if not exists kajabi_purchases_created_idx on public.kajabi_purchases(kajabi_created_at desc);
create index if not exists kajabi_customers_email_idx on public.kajabi_customers(email);
create index if not exists kajabi_purchase_products_product_idx on public.kajabi_purchase_products(kajabi_product_id);
create index if not exists sync_logs_started_idx on public.sync_logs(started_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_kajabi_tokens_updated_at on public.kajabi_tokens;
create trigger set_kajabi_tokens_updated_at
before update on public.kajabi_tokens
for each row execute function public.set_updated_at();

drop trigger if exists set_kajabi_customers_updated_at on public.kajabi_customers;
create trigger set_kajabi_customers_updated_at
before update on public.kajabi_customers
for each row execute function public.set_updated_at();

drop trigger if exists set_kajabi_offers_updated_at on public.kajabi_offers;
create trigger set_kajabi_offers_updated_at
before update on public.kajabi_offers
for each row execute function public.set_updated_at();

drop trigger if exists set_kajabi_products_updated_at on public.kajabi_products;
create trigger set_kajabi_products_updated_at
before update on public.kajabi_products
for each row execute function public.set_updated_at();

drop trigger if exists set_kajabi_purchases_updated_at on public.kajabi_purchases;
create trigger set_kajabi_purchases_updated_at
before update on public.kajabi_purchases
for each row execute function public.set_updated_at();

alter table public.kajabi_tokens enable row level security;
alter table public.kajabi_customers enable row level security;
alter table public.kajabi_offers enable row level security;
alter table public.kajabi_products enable row level security;
alter table public.kajabi_purchases enable row level security;
alter table public.kajabi_purchase_products enable row level security;
alter table public.sync_logs enable row level security;

-- This app uses the Supabase service role key from server-only code. No anon RLS
-- policies are created, so browser clients cannot read or write these tables.
