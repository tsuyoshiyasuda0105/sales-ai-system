-- 縺帙←繧晦I繧ｷ繧ｹ繝・Β DB螳夂ｾｩ v1
-- Section 03: 蝠・刀/隴伜挨蟄・逶ｸ蝣ｴ/AI蛻､螳夂ｳｻ
-- Target: PostgreSQL
-- Depends on:
--   db_schema_01_tenant_users.sql
--   db_schema_02_api_security.sql

create type product_status as enum (
  'active',
  'archived',
  'prohibited',
  'unknown'
);

create type product_condition as enum (
  'new',
  'like_new',
  'very_good',
  'good',
  'acceptable',
  'used',
  'junk',
  'unknown'
);

create type product_identifier_type as enum (
  'jan',
  'ean',
  'upc',
  'isbn',
  'asin',
  'sku',
  'model_number',
  'source_product_id',
  'channel_product_id',
  'other'
);

create type sales_channel as enum (
  'amazon_jp',
  'rakuten',
  'yahoo_shopping',
  'yahoo_auction',
  'mercari',
  'ebay',
  'store',
  'other'
);

create type sourcing_candidate_status as enum (
  'new',
  'watching',
  'approved',
  'rejected',
  'purchased',
  'expired',
  'archived'
);

create type ai_judgement as enum (
  'a',
  'b',
  'c',
  'ng',
  'unknown'
);

create type product_match_method as enum (
  'jan_exact',
  'asin_exact',
  'sku_exact',
  'model_number_exact',
  'title_similarity',
  'image_similarity',
  'manual',
  'ai_suggested',
  'unknown'
);

create type cross_channel_opportunity_type as enum (
  'buy_low_sell_high',
  'price_gap_watch',
  'restock_watch',
  'dead_stock_exit',
  'manual_review'
);

create table products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  title text not null,
  normalized_title text,
  brand text,
  manufacturer text,
  model_number text,
  category text,
  sub_category text,
  description text,
  image_url text,
  status product_status not null default 'active',
  default_condition product_condition not null default 'unknown',
  is_restricted boolean not null default false,
  restriction_reason text,
  notes text,
  created_by_user_id uuid references users (id) on delete set null,
  updated_by_user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_products_org on products (organization_id);
create index idx_products_title on products using gin (to_tsvector('simple', coalesce(title, '')));
create index idx_products_brand_model on products (organization_id, brand, model_number);
create index idx_products_status on products (organization_id, status);
create index idx_products_deleted_at on products (deleted_at);

create table product_identifiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  identifier_type product_identifier_type not null,
  identifier_value text not null,
  source_channel sales_channel,
  is_primary boolean not null default false,
  confidence_score numeric(5, 2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint product_identifiers_unique_value
    unique (organization_id, identifier_type, identifier_value)
);

create index idx_product_identifiers_org on product_identifiers (organization_id);
create index idx_product_identifiers_product on product_identifiers (product_id);
create index idx_product_identifiers_value on product_identifiers (identifier_type, identifier_value);
create index idx_product_identifiers_channel on product_identifiers (organization_id, source_channel);

create table market_prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  source_channel sales_channel not null,
  source_product_id text,
  source_url text,
  condition product_condition not null default 'unknown',
  price_amount numeric(18, 2) not null,
  currency_code char(3) not null default 'JPY',
  shipping_amount numeric(18, 2),
  point_value_amount numeric(18, 2),
  available_quantity integer,
  is_in_stock boolean,
  seller_name text,
  seller_count integer,
  sales_rank integer,
  review_count integer,
  review_rating numeric(3, 2),
  buy_box_price_amount numeric(18, 2),
  amazon_in_stock boolean,
  raw_payload jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_market_prices_org on market_prices (organization_id);
create index idx_market_prices_product_fetched on market_prices (product_id, fetched_at desc);
create index idx_market_prices_channel_fetched on market_prices (organization_id, source_channel, fetched_at desc);
create index idx_market_prices_source_product on market_prices (organization_id, source_channel, source_product_id);
create index idx_market_prices_sales_rank on market_prices (organization_id, sales_rank);

create table channel_product_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  channel sales_channel not null,
  channel_product_id text,
  channel_url text,
  channel_title text not null,
  channel_image_url text,
  condition product_condition not null default 'unknown',
  match_method product_match_method not null default 'unknown',
  confidence_score numeric(5, 2),
  is_verified boolean not null default false,
  verified_by_user_id uuid references users (id) on delete set null,
  verified_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint channel_product_matches_unique_channel_product
    unique (organization_id, channel, channel_product_id)
);

create index idx_channel_product_matches_org on channel_product_matches (organization_id);
create index idx_channel_product_matches_product on channel_product_matches (product_id);
create index idx_channel_product_matches_channel on channel_product_matches (organization_id, channel);
create index idx_channel_product_matches_confidence on channel_product_matches (organization_id, confidence_score desc);
create index idx_channel_product_matches_verified on channel_product_matches (organization_id, is_verified);

create table cross_channel_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  opportunity_type cross_channel_opportunity_type not null default 'buy_low_sell_high',
  buy_match_id uuid references channel_product_matches (id) on delete set null,
  sell_match_id uuid references channel_product_matches (id) on delete set null,
  buy_market_price_id uuid references market_prices (id) on delete set null,
  sell_market_price_id uuid references market_prices (id) on delete set null,
  buy_channel sales_channel not null,
  buy_channel_product_id text,
  buy_url text,
  buy_condition product_condition not null default 'unknown',
  buy_price_amount numeric(18, 2) not null,
  buy_shipping_amount numeric(18, 2) not null default 0,
  buy_point_value_amount numeric(18, 2) not null default 0,
  buy_currency_code char(3) not null default 'JPY',
  sell_channel sales_channel not null,
  sell_channel_product_id text,
  sell_url text,
  sell_condition product_condition not null default 'unknown',
  expected_sell_price_amount numeric(18, 2) not null,
  sell_currency_code char(3) not null default 'JPY',
  estimated_fee_amount numeric(18, 2) not null default 0,
  estimated_tax_amount numeric(18, 2) not null default 0,
  estimated_shipping_amount numeric(18, 2) not null default 0,
  estimated_packaging_amount numeric(18, 2) not null default 0,
  estimated_profit_amount numeric(18, 2),
  estimated_roi numeric(8, 4),
  estimated_profit_margin numeric(8, 4),
  match_confidence_score numeric(5, 2),
  demand_score numeric(5, 2),
  risk_score numeric(5, 2),
  judgement ai_judgement not null default 'unknown',
  reason_summary text,
  risk_notes text,
  fee_breakdown jsonb not null default '{}'::jsonb,
  calculation_version text,
  estimated_delivery_days integer,
  status sourcing_candidate_status not null default 'new',
  source_snapshot jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  discovered_by_job_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_cross_channel_opportunities_org_status on cross_channel_opportunities (organization_id, status);
create index idx_cross_channel_opportunities_product on cross_channel_opportunities (product_id);
create index idx_cross_channel_opportunities_channels on cross_channel_opportunities (organization_id, buy_channel, sell_channel);
create index idx_cross_channel_opportunities_matches on cross_channel_opportunities (buy_match_id, sell_match_id);
create index idx_cross_channel_opportunities_prices on cross_channel_opportunities (buy_market_price_id, sell_market_price_id);
create index idx_cross_channel_opportunities_profit on cross_channel_opportunities (organization_id, estimated_profit_amount desc);
create index idx_cross_channel_opportunities_roi on cross_channel_opportunities (organization_id, estimated_roi desc);
create index idx_cross_channel_opportunities_judgement on cross_channel_opportunities (organization_id, judgement);

create table sourcing_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  status sourcing_candidate_status not null default 'new',
  source_channel sales_channel not null,
  source_product_id text,
  source_url text,
  source_title text not null,
  source_condition product_condition not null default 'unknown',
  source_price_amount numeric(18, 2) not null,
  source_shipping_amount numeric(18, 2) not null default 0,
  source_point_value_amount numeric(18, 2) not null default 0,
  target_channel sales_channel not null default 'amazon_jp',
  target_product_id text,
  target_url text,
  target_expected_price_amount numeric(18, 2),
  estimated_platform_fee_amount numeric(18, 2),
  estimated_fba_fee_amount numeric(18, 2),
  estimated_shipping_amount numeric(18, 2),
  estimated_packaging_amount numeric(18, 2),
  estimated_profit_amount numeric(18, 2),
  estimated_roi numeric(8, 4),
  estimated_profit_margin numeric(8, 4),
  break_even_price_amount numeric(18, 2),
  recommended_max_purchase_quantity integer,
  expires_at timestamptz,
  discovered_by_job_run_id uuid,
  discovered_by_user_id uuid references users (id) on delete set null,
  approved_by_user_id uuid references users (id) on delete set null,
  approved_at timestamptz,
  rejected_reason text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_sourcing_candidates_org_status on sourcing_candidates (organization_id, status);
create index idx_sourcing_candidates_product on sourcing_candidates (product_id);
create index idx_sourcing_candidates_source on sourcing_candidates (organization_id, source_channel, source_product_id);
create index idx_sourcing_candidates_target on sourcing_candidates (organization_id, target_channel, target_product_id);
create index idx_sourcing_candidates_profit on sourcing_candidates (organization_id, estimated_profit_amount desc);
create index idx_sourcing_candidates_roi on sourcing_candidates (organization_id, estimated_roi desc);
create index idx_sourcing_candidates_created_at on sourcing_candidates (organization_id, created_at desc);

create table ai_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  sourcing_candidate_id uuid references sourcing_candidates (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  judgement ai_judgement not null default 'unknown',
  total_score numeric(5, 2),
  profit_score numeric(5, 2),
  demand_score numeric(5, 2),
  competition_score numeric(5, 2),
  turnover_score numeric(5, 2),
  risk_score numeric(5, 2),
  recommended_action text,
  recommended_quantity integer,
  reason_summary text,
  risk_notes text,
  model_name text,
  prompt_version text,
  input_snapshot jsonb not null default '{}'::jsonb,
  output_snapshot jsonb not null default '{}'::jsonb,
  created_by_job_run_id uuid,
  created_by_user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_ai_scores_org on ai_scores (organization_id);
create index idx_ai_scores_candidate on ai_scores (sourcing_candidate_id);
create index idx_ai_scores_product on ai_scores (product_id);
create index idx_ai_scores_judgement on ai_scores (organization_id, judgement);
create index idx_ai_scores_total_score on ai_scores (organization_id, total_score desc);
create index idx_ai_scores_created_at on ai_scores (organization_id, created_at desc);

create trigger trg_products_set_updated_at
before update on products
for each row execute function set_updated_at();

create trigger trg_product_identifiers_set_updated_at
before update on product_identifiers
for each row execute function set_updated_at();

create trigger trg_channel_product_matches_set_updated_at
before update on channel_product_matches
for each row execute function set_updated_at();

create trigger trg_sourcing_candidates_set_updated_at
before update on sourcing_candidates
for each row execute function set_updated_at();

create trigger trg_cross_channel_opportunities_set_updated_at
before update on cross_channel_opportunities
for each row execute function set_updated_at();

alter table products enable row level security;
alter table product_identifiers enable row level security;
alter table market_prices enable row level security;
alter table channel_product_matches enable row level security;
alter table cross_channel_opportunities enable row level security;
alter table sourcing_candidates enable row level security;
alter table ai_scores enable row level security;

create policy products_tenant_isolation on products
  using (organization_id = app.current_organization_id());

create policy product_identifiers_tenant_isolation on product_identifiers
  using (organization_id = app.current_organization_id());

create policy market_prices_tenant_isolation on market_prices
  using (organization_id = app.current_organization_id());

create policy channel_product_matches_tenant_isolation on channel_product_matches
  using (organization_id = app.current_organization_id());

create policy cross_channel_opportunities_tenant_isolation on cross_channel_opportunities
  using (organization_id = app.current_organization_id());

create policy sourcing_candidates_tenant_isolation on sourcing_candidates
  using (organization_id = app.current_organization_id());

create policy ai_scores_tenant_isolation on ai_scores
  using (organization_id = app.current_organization_id());

