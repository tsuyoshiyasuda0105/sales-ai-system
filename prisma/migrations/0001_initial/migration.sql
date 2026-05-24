-- Combined initial migration generated from db_schema_*.sql


-- ============================================================
-- Source: db_schema_01_tenant_users.sql
-- ============================================================

-- 縺帙←繧晦I繧ｷ繧ｹ繝・Β DB螳夂ｾｩ v1
-- Section 01: 繝・リ繝ｳ繝・繝ｦ繝ｼ繧ｶ繝ｼ邉ｻ
-- Target: PostgreSQL

create extension if not exists pgcrypto;

create type organization_member_role as enum (
  'owner',
  'admin',
  'member'
);

create type organization_member_status as enum (
  'invited',
  'active',
  'suspended',
  'left'
);

create type organization_status as enum (
  'active',
  'suspended',
  'closed'
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text not null,
  name text,
  avatar_url text,
  password_hash text,
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint users_email_normalized_unique unique (email_normalized)
);

create index idx_users_deleted_at on users (deleted_at);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  status organization_status not null default 'active',
  timezone text not null default 'Asia/Tokyo',
  currency_code char(3) not null default 'JPY',
  owner_user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint organizations_slug_unique unique (slug)
);

create index idx_organizations_status on organizations (status);
create index idx_organizations_deleted_at on organizations (deleted_at);

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  role organization_member_role not null default 'member',
  status organization_member_status not null default 'active',
  invited_by_user_id uuid references users (id) on delete set null,
  invited_at timestamptz,
  joined_at timestamptz,
  suspended_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint organization_members_unique_member unique (organization_id, user_id)
);

create index idx_organization_members_org on organization_members (organization_id);
create index idx_organization_members_user on organization_members (user_id);
create index idx_organization_members_role on organization_members (organization_id, role);
create index idx_organization_members_status on organization_members (organization_id, status);
create index idx_organization_members_deleted_at on organization_members (deleted_at);

create table organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  email text not null,
  email_normalized text not null,
  role organization_member_role not null default 'member',
  token_hash text not null,
  invited_by_user_id uuid references users (id) on delete set null,
  accepted_by_user_id uuid references users (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint organization_invitations_token_hash_unique unique (token_hash)
);

create index idx_organization_invitations_org on organization_invitations (organization_id);
create index idx_organization_invitations_email on organization_invitations (organization_id, email_normalized);
create index idx_organization_invitations_expires_at on organization_invitations (expires_at);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  session_token_hash text not null,
  ip_address inet,
  user_agent text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessions_token_hash_unique unique (session_token_hash)
);

create index idx_sessions_user on sessions (user_id);
create index idx_sessions_expires_at on sessions (expires_at);
create index idx_sessions_revoked_at on sessions (revoked_at);

create table login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,
  email_normalized text,
  success boolean not null,
  failure_reason text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_login_events_user on login_events (user_id);
create index idx_login_events_email on login_events (email_normalized);
create index idx_login_events_created_at on login_events (created_at);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create schema if not exists app;

-- Safely returns the current tenant id set by the application.
-- If unset, empty, or invalid, returns NULL instead of raising an invalid UUID error.
create or replace function app.current_organization_id()
returns uuid as $$
declare
  org_id text;
begin
  org_id := nullif(current_setting('app.current_organization_id', true), '');
  if org_id is null then
    return null;
  end if;

  return org_id::uuid;
exception when invalid_text_representation then
  return null;
end;
$$ language plpgsql stable;

create trigger trg_users_set_updated_at
before update on users
for each row execute function set_updated_at();

create trigger trg_organizations_set_updated_at
before update on organizations
for each row execute function set_updated_at();

create trigger trg_organization_members_set_updated_at
before update on organization_members
for each row execute function set_updated_at();

create trigger trg_organization_invitations_set_updated_at
before update on organization_invitations
for each row execute function set_updated_at();

create trigger trg_sessions_set_updated_at
before update on sessions
for each row execute function set_updated_at();


-- ============================================================
-- Source: db_schema_02_api_security.sql
-- ============================================================

-- 縺帙←繧晦I繧ｷ繧ｹ繝・Β DB螳夂ｾｩ v1
-- Section 02: API騾｣謳ｺ/繧ｻ繧ｭ繝･繝ｪ繝・ぅ邉ｻ
-- Target: PostgreSQL
-- Depends on: db_schema_01_tenant_users.sql

create type api_provider as enum (
  'amazon_sp_api',
  'keepa',
  'rakuten',
  'yahoo_shopping',
  'yahoo_auction',
  'ebay',
  'freee',
  'money_forward',
  'openai',
  'other'
);

create type api_credential_status as enum (
  'active',
  'expired',
  'revoked',
  'error',
  'disabled'
);

create type encryption_provider as enum (
  'aws_kms',
  'gcp_kms',
  'azure_key_vault',
  'hashicorp_vault',
  'local_dev'
);

create type security_event_severity as enum (
  'info',
  'warning',
  'critical'
);

create type audit_action_type as enum (
  'create',
  'read',
  'update',
  'delete',
  'export',
  'login',
  'logout',
  'connect_api',
  'disconnect_api',
  'run_job',
  'change_role',
  'billing_change',
  'other'
);

create table api_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  provider api_provider not null,
  display_name text,
  status api_credential_status not null default 'active',
  encryption_provider encryption_provider not null default 'aws_kms',
  kms_key_id text not null,
  encrypted_data_key bytea,
  encryption_context jsonb not null default '{}'::jsonb,
  encryption_algorithm text not null default 'AES-256-GCM',
  encrypted_access_token bytea,
  encrypted_refresh_token bytea,
  encrypted_api_key bytea,
  encrypted_api_secret bytea,
  scopes text[] not null default '{}',
  external_account_id text,
  external_account_name text,
  expires_at timestamptz,
  last_verified_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_by_user_id uuid references users (id) on delete set null,
  updated_by_user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint api_credentials_unique_provider_account
    unique (organization_id, provider, external_account_id)
);

create index idx_api_credentials_org on api_credentials (organization_id);
create index idx_api_credentials_provider on api_credentials (organization_id, provider);
create index idx_api_credentials_status on api_credentials (organization_id, status);
create index idx_api_credentials_expires_at on api_credentials (expires_at);
create index idx_api_credentials_deleted_at on api_credentials (deleted_at);

create table api_credential_access_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  api_credential_id uuid references api_credentials (id) on delete set null,
  user_id uuid references users (id) on delete set null,
  job_run_id uuid,
  action text not null,
  provider api_provider,
  success boolean not null,
  failure_reason text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_api_credential_access_logs_org on api_credential_access_logs (organization_id);
create index idx_api_credential_access_logs_credential on api_credential_access_logs (api_credential_id);
create index idx_api_credential_access_logs_user on api_credential_access_logs (user_id);
create index idx_api_credential_access_logs_created_at on api_credential_access_logs (created_at);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations (id) on delete cascade,
  user_id uuid references users (id) on delete set null,
  action audit_action_type not null,
  resource_type text not null,
  resource_id uuid,
  summary text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_org on audit_logs (organization_id);
create index idx_audit_logs_user on audit_logs (user_id);
create index idx_audit_logs_resource on audit_logs (resource_type, resource_id);
create index idx_audit_logs_action on audit_logs (action);
create index idx_audit_logs_created_at on audit_logs (created_at);

create table security_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations (id) on delete cascade,
  user_id uuid references users (id) on delete set null,
  severity security_event_severity not null default 'info',
  event_type text not null,
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  resolved_at timestamptz,
  resolved_by_user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_security_events_org on security_events (organization_id);
create index idx_security_events_user on security_events (user_id);
create index idx_security_events_severity on security_events (severity);
create index idx_security_events_event_type on security_events (event_type);
create index idx_security_events_created_at on security_events (created_at);
create index idx_security_events_unresolved on security_events (organization_id, resolved_at);

create table usage_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid references users (id) on delete set null,
  provider api_provider not null,
  usage_type text not null,
  quantity numeric(18, 6) not null default 1,
  unit text not null default 'request',
  cost_amount numeric(18, 6),
  cost_currency char(3),
  related_resource_type text,
  related_resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_usage_logs_org on usage_logs (organization_id);
create index idx_usage_logs_provider on usage_logs (organization_id, provider);
create index idx_usage_logs_usage_type on usage_logs (organization_id, usage_type);
create index idx_usage_logs_occurred_at on usage_logs (occurred_at);

create table organization_security_settings (
  organization_id uuid primary key references organizations (id) on delete cascade,
  require_mfa boolean not null default false,
  allowed_ip_ranges cidr[] not null default '{}',
  session_timeout_minutes integer not null default 43200,
  api_key_rotation_days integer,
  audit_log_retention_days integer not null default 365,
  security_event_retention_days integer not null default 365,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_api_credentials_set_updated_at
before update on api_credentials
for each row execute function set_updated_at();

create trigger trg_organization_security_settings_set_updated_at
before update on organization_security_settings
for each row execute function set_updated_at();

alter table api_credentials enable row level security;
alter table api_credential_access_logs enable row level security;
alter table audit_logs enable row level security;
alter table security_events enable row level security;
alter table usage_logs enable row level security;
alter table organization_security_settings enable row level security;

create policy api_credentials_tenant_isolation on api_credentials
  using (organization_id = app.current_organization_id());

create policy api_credential_access_logs_tenant_isolation on api_credential_access_logs
  using (organization_id = app.current_organization_id());

create policy audit_logs_tenant_isolation on audit_logs
  using (
    organization_id is null
    or organization_id = app.current_organization_id()
  );

create policy security_events_tenant_isolation on security_events
  using (
    organization_id is null
    or organization_id = app.current_organization_id()
  );

create policy usage_logs_tenant_isolation on usage_logs
  using (organization_id = app.current_organization_id());

create policy organization_security_settings_tenant_isolation on organization_security_settings
  using (organization_id = app.current_organization_id());


-- ============================================================
-- Source: db_schema_03_products_market.sql
-- ============================================================

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


-- ============================================================
-- Source: db_schema_04_inventory.sql
-- ============================================================

-- Sedori AI system DB schema v1
-- Section 04: Inventory / purchasing / secondhand trade records
-- Target: PostgreSQL
-- Depends on:
--   db_schema_01_tenant_users.sql
--   db_schema_02_api_security.sql
--   db_schema_03_products_market.sql

create type supplier_type as enum (
  'business',
  'individual',
  'marketplace_seller',
  'auction_house',
  'recycle_shop',
  'other'
);

create type purchase_order_status as enum (
  'draft',
  'ordered',
  'partially_received',
  'received',
  'cancelled',
  'closed'
);

create type receipt_status as enum (
  'pending',
  'received',
  'partially_inspected',
  'inspected',
  'rejected',
  'cancelled'
);

create type inventory_status as enum (
  'candidate',
  'purchased',
  'received',
  'inspected',
  'listed',
  'reserved',
  'sold',
  'returned',
  'dead_stock',
  'disposed'
);

create type inventory_movement_type as enum (
  'purchase',
  'receive',
  'inspect',
  'adjust',
  'list',
  'reserve',
  'sell',
  'return',
  'mark_dead_stock',
  'dispose',
  'transfer',
  'cancel'
);

create type secondhand_identity_verification_method as enum (
  'driver_license',
  'my_number_card',
  'passport',
  'residence_card',
  'health_insurance_card',
  'corporate_registry',
  'platform_verified',
  'other',
  'not_required'
);

create type secondhand_trade_direction as enum (
  'purchase',
  'return_to_supplier',
  'correction'
);

-- Suppliers include businesses, individual sellers, marketplaces, auctions, and shops.
-- Individual secondhand seller identity is recorded per transaction in secondhand_trade_records.
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  supplier_type supplier_type not null default 'business',
  name text not null,
  legal_name text,
  name_kana text,
  contact_name text,
  email text,
  phone text,
  postal_code text,
  prefecture text,
  city text,
  address_line1 text,
  address_line2 text,
  country_code char(2) not null default 'JP',
  marketplace_channel sales_channel,
  marketplace_seller_id text,
  marketplace_seller_url text,
  registration_number text,
  antique_dealer_permit_number text,
  payment_terms text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references users (id) on delete set null,
  updated_by_user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint suppliers_marketplace_seller_unique
    unique (organization_id, marketplace_channel, marketplace_seller_id)
);

create index idx_suppliers_org on suppliers (organization_id);
create index idx_suppliers_type on suppliers (organization_id, supplier_type);
create index idx_suppliers_name on suppliers using gin (to_tsvector('simple', coalesce(name, '')));
create index idx_suppliers_marketplace on suppliers (organization_id, marketplace_channel, marketplace_seller_id);
create index idx_suppliers_deleted_at on suppliers (deleted_at);

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  supplier_id uuid references suppliers (id) on delete set null,
  sourcing_candidate_id uuid references sourcing_candidates (id) on delete set null,
  order_number text not null,
  supplier_order_reference text,
  source_channel sales_channel,
  source_url text,
  status purchase_order_status not null default 'draft',
  ordered_at timestamptz,
  expected_delivery_at timestamptz,
  cancelled_at timestamptz,
  closed_at timestamptz,
  currency_code char(3) not null default 'JPY',
  subtotal_amount numeric(18, 2) not null default 0,
  shipping_amount numeric(18, 2) not null default 0,
  tax_amount numeric(18, 2) not null default 0,
  discount_amount numeric(18, 2) not null default 0,
  total_amount numeric(18, 2) not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references users (id) on delete set null,
  updated_by_user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint purchase_orders_order_number_unique
    unique (organization_id, order_number),
  constraint purchase_orders_amounts_non_negative
    check (
      subtotal_amount >= 0
      and shipping_amount >= 0
      and tax_amount >= 0
      and discount_amount >= 0
      and total_amount >= 0
    )
);

create index idx_purchase_orders_org_status on purchase_orders (organization_id, status);
create index idx_purchase_orders_supplier on purchase_orders (supplier_id);
create index idx_purchase_orders_ordered_at on purchase_orders (organization_id, ordered_at desc);
create index idx_purchase_orders_source on purchase_orders (organization_id, source_channel, supplier_order_reference);
create index idx_purchase_orders_deleted_at on purchase_orders (deleted_at);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  purchase_order_id uuid not null references purchase_orders (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  sourcing_candidate_id uuid references sourcing_candidates (id) on delete set null,
  line_number integer not null,
  supplier_sku text,
  source_product_id text,
  source_url text,
  title text not null,
  condition product_condition not null default 'unknown',
  quantity_ordered integer not null default 1,
  quantity_cancelled integer not null default 0,
  unit_cost_amount numeric(18, 2) not null default 0,
  shipping_allocated_amount numeric(18, 2) not null default 0,
  tax_allocated_amount numeric(18, 2) not null default 0,
  discount_allocated_amount numeric(18, 2) not null default 0,
  total_cost_amount numeric(18, 2) not null default 0,
  expected_profit_amount numeric(18, 2),
  expected_roi numeric(8, 4),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint purchase_order_items_unique_line
    unique (purchase_order_id, line_number),
  constraint purchase_order_items_quantities_valid
    check (
      quantity_ordered > 0
      and quantity_cancelled >= 0
      and quantity_cancelled <= quantity_ordered
    ),
  constraint purchase_order_items_amounts_non_negative
    check (
      unit_cost_amount >= 0
      and shipping_allocated_amount >= 0
      and tax_allocated_amount >= 0
      and discount_allocated_amount >= 0
      and total_cost_amount >= 0
    )
);

create index idx_purchase_order_items_org on purchase_order_items (organization_id);
create index idx_purchase_order_items_order on purchase_order_items (purchase_order_id);
create index idx_purchase_order_items_product on purchase_order_items (product_id);
create index idx_purchase_order_items_candidate on purchase_order_items (sourcing_candidate_id);
create index idx_purchase_order_items_deleted_at on purchase_order_items (deleted_at);

-- A receipt represents a received PO line batch. Multiple receipts can exist for one PO item.
create table receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  purchase_order_id uuid references purchase_orders (id) on delete set null,
  purchase_order_item_id uuid references purchase_order_items (id) on delete set null,
  supplier_id uuid references suppliers (id) on delete set null,
  product_id uuid references products (id) on delete set null,
  receipt_number text not null,
  status receipt_status not null default 'pending',
  received_quantity integer not null default 0,
  rejected_quantity integer not null default 0,
  condition product_condition not null default 'unknown',
  carrier text,
  tracking_number text,
  received_at timestamptz,
  inspected_at timestamptz,
  received_by_user_id uuid references users (id) on delete set null,
  inspected_by_user_id uuid references users (id) on delete set null,
  storage_location_code text,
  rejection_reason text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint receipts_receipt_number_unique
    unique (organization_id, receipt_number),
  constraint receipts_quantities_valid
    check (
      received_quantity >= 0
      and rejected_quantity >= 0
      and rejected_quantity <= received_quantity
    )
);

create index idx_receipts_org_status on receipts (organization_id, status);
create index idx_receipts_order on receipts (purchase_order_id);
create index idx_receipts_order_item on receipts (purchase_order_item_id);
create index idx_receipts_supplier on receipts (supplier_id);
create index idx_receipts_product on receipts (product_id);
create index idx_receipts_received_at on receipts (organization_id, received_at desc);
create index idx_receipts_deleted_at on receipts (deleted_at);

-- Required by Japanese secondhand goods bookkeeping: supplier identity, verification,
-- transaction date, item, quantity, and amount are snapshotted per trade.
create table secondhand_trade_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  supplier_id uuid references suppliers (id) on delete set null,
  purchase_order_id uuid references purchase_orders (id) on delete set null,
  purchase_order_item_id uuid references purchase_order_items (id) on delete set null,
  receipt_id uuid references receipts (id) on delete set null,
  product_id uuid references products (id) on delete set null,
  record_number text not null,
  trade_direction secondhand_trade_direction not null default 'purchase',
  trade_date date not null,
  trade_place text,
  supplier_name_snapshot text not null,
  supplier_address_snapshot text,
  supplier_phone_snapshot text,
  supplier_birthdate date,
  supplier_occupation text,
  identity_verification_method secondhand_identity_verification_method not null,
  identity_document_type text,
  identity_document_number_hash text,
  identity_document_issuer text,
  identity_verified_at timestamptz,
  identity_verified_by_user_id uuid references users (id) on delete set null,
  item_name text not null,
  item_category text,
  item_brand text,
  item_model_number text,
  item_serial_number text,
  item_features text,
  condition product_condition not null default 'unknown',
  quantity integer not null,
  unit_amount numeric(18, 2) not null default 0,
  total_amount numeric(18, 2) not null default 0,
  currency_code char(3) not null default 'JPY',
  notes text,
  retention_until date,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references users (id) on delete set null,
  updated_by_user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint secondhand_trade_records_record_number_unique
    unique (organization_id, record_number),
  constraint secondhand_trade_records_quantity_positive
    check (quantity > 0),
  constraint secondhand_trade_records_amounts_non_negative
    check (unit_amount >= 0 and total_amount >= 0)
);

create index idx_secondhand_trade_records_org_trade_date
  on secondhand_trade_records (organization_id, trade_date desc);
create index idx_secondhand_trade_records_supplier on secondhand_trade_records (supplier_id);
create index idx_secondhand_trade_records_order_item on secondhand_trade_records (purchase_order_item_id);
create index idx_secondhand_trade_records_receipt on secondhand_trade_records (receipt_id);
create index idx_secondhand_trade_records_product on secondhand_trade_records (product_id);
create index idx_secondhand_trade_records_item_name
  on secondhand_trade_records using gin (to_tsvector('simple', coalesce(item_name, '')));
create index idx_secondhand_trade_records_deleted_at on secondhand_trade_records (deleted_at);

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  supplier_id uuid references suppliers (id) on delete set null,
  purchase_order_id uuid references purchase_orders (id) on delete set null,
  purchase_order_item_id uuid references purchase_order_items (id) on delete set null,
  receipt_id uuid references receipts (id) on delete set null,
  secondhand_trade_record_id uuid references secondhand_trade_records (id) on delete set null,
  sourcing_candidate_id uuid references sourcing_candidates (id) on delete set null,
  inventory_sku text not null,
  supplier_sku text,
  serial_number text,
  status inventory_status not null default 'candidate',
  condition product_condition not null default 'unknown',
  quantity integer not null default 1,
  acquisition_cost_amount numeric(18, 2) not null default 0,
  carrying_cost_amount numeric(18, 2) not null default 0,
  expected_sell_price_amount numeric(18, 2),
  listed_channel sales_channel,
  listed_channel_item_id text,
  listed_url text,
  listed_price_amount numeric(18, 2),
  warehouse_code text,
  location_code text,
  bin_code text,
  received_at timestamptz,
  inspected_at timestamptz,
  listed_at timestamptz,
  reserved_at timestamptz,
  sold_at timestamptz,
  returned_at timestamptz,
  dead_stock_at timestamptz,
  disposed_at timestamptz,
  reserved_reference_type text,
  reserved_reference_id uuid,
  sold_reference_type text,
  sold_reference_id uuid,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references users (id) on delete set null,
  updated_by_user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint inventory_items_sku_unique
    unique (organization_id, inventory_sku),
  constraint inventory_items_quantity_positive
    check (quantity > 0),
  constraint inventory_items_amounts_non_negative
    check (
      acquisition_cost_amount >= 0
      and carrying_cost_amount >= 0
      and (expected_sell_price_amount is null or expected_sell_price_amount >= 0)
      and (listed_price_amount is null or listed_price_amount >= 0)
    )
);

create index idx_inventory_items_org_status on inventory_items (organization_id, status);
create index idx_inventory_items_product on inventory_items (product_id);
create index idx_inventory_items_supplier on inventory_items (supplier_id);
create index idx_inventory_items_order_item on inventory_items (purchase_order_item_id);
create index idx_inventory_items_receipt on inventory_items (receipt_id);
create index idx_inventory_items_secondhand_record on inventory_items (secondhand_trade_record_id);
create index idx_inventory_items_location on inventory_items (organization_id, warehouse_code, location_code, bin_code);
create index idx_inventory_items_listed on inventory_items (organization_id, listed_channel, listed_channel_item_id);
create index idx_inventory_items_status_updated on inventory_items (organization_id, status, updated_at desc);
create index idx_inventory_items_deleted_at on inventory_items (deleted_at);

create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  inventory_item_id uuid not null references inventory_items (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  movement_type inventory_movement_type not null,
  from_status inventory_status,
  to_status inventory_status,
  quantity_delta integer not null,
  from_warehouse_code text,
  from_location_code text,
  from_bin_code text,
  to_warehouse_code text,
  to_location_code text,
  to_bin_code text,
  reference_type text,
  reference_id uuid,
  reason text,
  notes text,
  occurred_at timestamptz not null default now(),
  created_by_user_id uuid references users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint inventory_movements_quantity_delta_not_zero
    check (quantity_delta <> 0)
);

create index idx_inventory_movements_org_occurred_at
  on inventory_movements (organization_id, occurred_at desc);
create index idx_inventory_movements_item on inventory_movements (inventory_item_id, occurred_at desc);
create index idx_inventory_movements_product on inventory_movements (product_id);
create index idx_inventory_movements_type on inventory_movements (organization_id, movement_type);
create index idx_inventory_movements_reference on inventory_movements (reference_type, reference_id);
create index idx_inventory_movements_deleted_at on inventory_movements (deleted_at);

create trigger trg_suppliers_set_updated_at
before update on suppliers
for each row execute function set_updated_at();

create trigger trg_purchase_orders_set_updated_at
before update on purchase_orders
for each row execute function set_updated_at();

create trigger trg_purchase_order_items_set_updated_at
before update on purchase_order_items
for each row execute function set_updated_at();

create trigger trg_receipts_set_updated_at
before update on receipts
for each row execute function set_updated_at();

create trigger trg_secondhand_trade_records_set_updated_at
before update on secondhand_trade_records
for each row execute function set_updated_at();

create trigger trg_inventory_items_set_updated_at
before update on inventory_items
for each row execute function set_updated_at();

create trigger trg_inventory_movements_set_updated_at
before update on inventory_movements
for each row execute function set_updated_at();

alter table suppliers enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table receipts enable row level security;
alter table secondhand_trade_records enable row level security;
alter table inventory_items enable row level security;
alter table inventory_movements enable row level security;

create policy suppliers_tenant_isolation on suppliers
  using (organization_id = app.current_organization_id());

create policy purchase_orders_tenant_isolation on purchase_orders
  using (organization_id = app.current_organization_id());

create policy purchase_order_items_tenant_isolation on purchase_order_items
  using (organization_id = app.current_organization_id());

create policy receipts_tenant_isolation on receipts
  using (organization_id = app.current_organization_id());

create policy secondhand_trade_records_tenant_isolation on secondhand_trade_records
  using (organization_id = app.current_organization_id());

create policy inventory_items_tenant_isolation on inventory_items
  using (organization_id = app.current_organization_id());

create policy inventory_movements_tenant_isolation on inventory_movements
  using (organization_id = app.current_organization_id());


-- ============================================================
-- Source: db_schema_05_sales_orders.sql
-- ============================================================

-- 縺帙←繧晦I繧ｷ繧ｹ繝・Β DB螳夂ｾｩ v1
-- Section 05: 雋ｩ螢ｲ/豕ｨ譁・逋ｺ騾・霑泌刀邉ｻ
-- Target: PostgreSQL
-- Depends on:
--   db_schema_01_tenant_users.sql
--   db_schema_02_api_security.sql
--   db_schema_03_products_market.sql
--   db_schema_04_inventory.sql

create type listing_status as enum (
  'draft',
  'active',
  'paused',
  'sold',
  'ended',
  'error',
  'archived'
);

create type order_status as enum (
  'pending',
  'paid',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
  'refunded',
  'unknown'
);

create type shipment_status as enum (
  'pending',
  'label_created',
  'shipped',
  'in_transit',
  'delivered',
  'lost',
  'cancelled',
  'unknown'
);

create type return_status as enum (
  'requested',
  'approved',
  'received',
  'refunded',
  'rejected',
  'closed'
);

create type fee_type as enum (
  'platform_fee',
  'payment_fee',
  'fba_fee',
  'shipping_fee',
  'storage_fee',
  'refund_fee',
  'promotion_fee',
  'other'
);

create table channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  channel sales_channel not null,
  name text not null,
  api_credential_id uuid references api_credentials (id) on delete set null,
  is_enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references users (id) on delete set null,
  updated_by_user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint channels_unique_channel_name unique (organization_id, channel, name)
);

create index idx_channels_org on channels (organization_id);
create index idx_channels_channel on channels (organization_id, channel);
create index idx_channels_enabled on channels (organization_id, is_enabled);

create table listings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  channel_id uuid references channels (id) on delete set null,
  channel sales_channel not null,
  inventory_item_id uuid,
  product_id uuid references products (id) on delete set null,
  external_listing_id text,
  external_product_id text,
  listing_url text,
  title text not null,
  status listing_status not null default 'draft',
  listed_price_amount numeric(18, 2),
  currency_code char(3) not null default 'JPY',
  listed_quantity integer not null default 1,
  available_quantity integer not null default 1,
  condition product_condition not null default 'unknown',
  listed_at timestamptz,
  ended_at timestamptz,
  last_synced_at timestamptz,
  sync_error_message text,
  raw_payload jsonb,
  created_by_user_id uuid references users (id) on delete set null,
  updated_by_user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_listings_org_status on listings (organization_id, status);
create index idx_listings_channel on listings (organization_id, channel);
create index idx_listings_inventory_item on listings (inventory_item_id);
create index idx_listings_product on listings (product_id);
create index idx_listings_external on listings (organization_id, channel, external_listing_id);

create table orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  channel_id uuid references channels (id) on delete set null,
  channel sales_channel not null,
  external_order_id text,
  status order_status not null default 'unknown',
  buyer_name text,
  buyer_email_hash text,
  ordered_at timestamptz,
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  subtotal_amount numeric(18, 2) not null default 0,
  shipping_amount numeric(18, 2) not null default 0,
  discount_amount numeric(18, 2) not null default 0,
  tax_amount numeric(18, 2) not null default 0,
  total_amount numeric(18, 2) not null default 0,
  currency_code char(3) not null default 'JPY',
  settlement_amount numeric(18, 2),
  settlement_date date,
  raw_payload jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint orders_unique_external unique (organization_id, channel, external_order_id)
);

create index idx_orders_org_status on orders (organization_id, status);
create index idx_orders_channel_ordered on orders (organization_id, channel, ordered_at desc);
create index idx_orders_ordered_at on orders (organization_id, ordered_at desc);
create index idx_orders_settlement_date on orders (organization_id, settlement_date);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  order_id uuid not null references orders (id) on delete cascade,
  listing_id uuid references listings (id) on delete set null,
  inventory_item_id uuid,
  product_id uuid references products (id) on delete set null,
  external_order_item_id text,
  title text not null,
  quantity integer not null default 1,
  unit_price_amount numeric(18, 2) not null default 0,
  subtotal_amount numeric(18, 2) not null default 0,
  tax_amount numeric(18, 2) not null default 0,
  currency_code char(3) not null default 'JPY',
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_order_items_org on order_items (organization_id);
create index idx_order_items_order on order_items (order_id);
create index idx_order_items_inventory_item on order_items (inventory_item_id);
create index idx_order_items_product on order_items (product_id);

create table fees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  order_id uuid references orders (id) on delete cascade,
  order_item_id uuid references order_items (id) on delete cascade,
  listing_id uuid references listings (id) on delete set null,
  fee_type fee_type not null,
  description text,
  amount numeric(18, 2) not null,
  currency_code char(3) not null default 'JPY',
  charged_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_fees_org on fees (organization_id);
create index idx_fees_order on fees (order_id);
create index idx_fees_type on fees (organization_id, fee_type);
create index idx_fees_charged_at on fees (organization_id, charged_at desc);

create table shipments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  order_id uuid references orders (id) on delete set null,
  shipment_status shipment_status not null default 'pending',
  carrier text,
  service_level text,
  tracking_number text,
  shipping_label_url text,
  shipping_cost_amount numeric(18, 2),
  currency_code char(3) not null default 'JPY',
  shipped_at timestamptz,
  delivered_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_shipments_org_status on shipments (organization_id, shipment_status);
create index idx_shipments_order on shipments (order_id);
create index idx_shipments_tracking on shipments (tracking_number);

create table returns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  order_id uuid references orders (id) on delete set null,
  order_item_id uuid references order_items (id) on delete set null,
  inventory_item_id uuid,
  return_status return_status not null default 'requested',
  reason text,
  refund_amount numeric(18, 2),
  currency_code char(3) not null default 'JPY',
  requested_at timestamptz,
  received_at timestamptz,
  refunded_at timestamptz,
  restockable boolean,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_returns_org_status on returns (organization_id, return_status);
create index idx_returns_order on returns (order_id);
create index idx_returns_inventory_item on returns (inventory_item_id);

create trigger trg_channels_set_updated_at
before update on channels
for each row execute function set_updated_at();

create trigger trg_listings_set_updated_at
before update on listings
for each row execute function set_updated_at();

create trigger trg_orders_set_updated_at
before update on orders
for each row execute function set_updated_at();

create trigger trg_order_items_set_updated_at
before update on order_items
for each row execute function set_updated_at();

create trigger trg_fees_set_updated_at
before update on fees
for each row execute function set_updated_at();

create trigger trg_shipments_set_updated_at
before update on shipments
for each row execute function set_updated_at();

create trigger trg_returns_set_updated_at
before update on returns
for each row execute function set_updated_at();

alter table channels enable row level security;
alter table listings enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table fees enable row level security;
alter table shipments enable row level security;
alter table returns enable row level security;

create policy channels_tenant_isolation on channels
  using (organization_id = app.current_organization_id());

create policy listings_tenant_isolation on listings
  using (organization_id = app.current_organization_id());

create policy orders_tenant_isolation on orders
  using (organization_id = app.current_organization_id());

create policy order_items_tenant_isolation on order_items
  using (organization_id = app.current_organization_id());

create policy fees_tenant_isolation on fees
  using (organization_id = app.current_organization_id());

create policy shipments_tenant_isolation on shipments
  using (organization_id = app.current_organization_id());

create policy returns_tenant_isolation on returns
  using (organization_id = app.current_organization_id());


-- ============================================================
-- Source: db_schema_06_accounting.sql
-- ============================================================

-- Sedori AI system DB schema v1
-- Section 06: Accounting / settlement / cashflow / tax summaries
-- Target: PostgreSQL
-- Depends on:
--   db_schema_01_tenant_users.sql
--   db_schema_02_api_security.sql
--   db_schema_03_products_market.sql
--   db_schema_04_inventory.sql
--   db_schema_05_sales_orders.sql

create type accounting_entry_type as enum (
  'sale',
  'purchase',
  'cost_of_goods_sold',
  'inventory_adjustment',
  'platform_fee',
  'shipping_income',
  'shipping_expense',
  'refund',
  'tax',
  'cash_transfer',
  'other'
);

create type accounting_entry_status as enum (
  'draft',
  'ready',
  'exported',
  'synced',
  'excluded',
  'error'
);

create type accounting_export_status as enum (
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

create type accounting_export_format as enum (
  'freee_csv',
  'money_forward_csv',
  'yayoi_csv',
  'generic_csv',
  'freee_api',
  'other'
);

create type settlement_report_status as enum (
  'imported',
  'matched',
  'partially_matched',
  'unmatched',
  'closed'
);

create type cashflow_snapshot_period as enum (
  'daily',
  'weekly',
  'monthly'
);

create type tax_report_period as enum (
  'monthly',
  'quarterly',
  'yearly'
);

-- Chart of accounts per organization.
-- Keeps export mapping flexible for freee/MF/Yayoi/generic CSV.
create table accounting_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  account_code text,
  account_name text not null,
  tax_category text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint accounting_accounts_unique_name unique (organization_id, account_name)
);

create index idx_accounting_accounts_org on accounting_accounts (organization_id);
create index idx_accounting_accounts_active on accounting_accounts (organization_id, is_active);

-- Accounting entries generated from purchases, orders, fees, shipping, inventory, and refunds.
-- This is not tax advice; it prepares accounting data for user/accountant review.
create table accounting_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  entry_type accounting_entry_type not null,
  status accounting_entry_status not null default 'draft',
  occurred_on date not null,
  description text not null,
  debit_account_id uuid references accounting_accounts (id) on delete set null,
  credit_account_id uuid references accounting_accounts (id) on delete set null,
  debit_account_name text,
  credit_account_name text,
  amount numeric(18, 2) not null,
  tax_amount numeric(18, 2) not null default 0,
  currency_code char(3) not null default 'JPY',
  tax_category text,
  source_resource_type text,
  source_resource_id uuid,
  order_id uuid references orders (id) on delete set null,
  order_item_id uuid references order_items (id) on delete set null,
  purchase_order_id uuid references purchase_orders (id) on delete set null,
  purchase_order_item_id uuid references purchase_order_items (id) on delete set null,
  inventory_item_id uuid references inventory_items (id) on delete set null,
  fee_id uuid references fees (id) on delete set null,
  shipment_id uuid references shipments (id) on delete set null,
  return_id uuid references returns (id) on delete set null,
  receipt_id uuid references receipts (id) on delete set null,
  external_accounting_id text,
  exported_at timestamptz,
  synced_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_job_run_id uuid,
  created_by_user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_accounting_entries_org_status on accounting_entries (organization_id, status);
create index idx_accounting_entries_occurred_on on accounting_entries (organization_id, occurred_on desc);
create index idx_accounting_entries_type on accounting_entries (organization_id, entry_type);
create index idx_accounting_entries_order on accounting_entries (order_id);
create index idx_accounting_entries_purchase on accounting_entries (purchase_order_id);
create index idx_accounting_entries_inventory on accounting_entries (inventory_item_id);
create index idx_accounting_entries_source on accounting_entries (source_resource_type, source_resource_id);

-- Accounting export batches.
-- Tracks CSV/API export execution and prevents duplicate exports.
create table accounting_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  export_format accounting_export_format not null,
  status accounting_export_status not null default 'pending',
  period_start date not null,
  period_end date not null,
  file_name text,
  file_url text,
  external_batch_id text,
  entry_count integer not null default 0,
  total_amount numeric(18, 2) not null default 0,
  requested_by_user_id uuid references users (id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_accounting_exports_org_status on accounting_exports (organization_id, status);
create index idx_accounting_exports_period on accounting_exports (organization_id, period_start, period_end);

create table accounting_export_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  accounting_export_id uuid not null references accounting_exports (id) on delete cascade,
  accounting_entry_id uuid not null references accounting_entries (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint accounting_export_entries_unique unique (accounting_export_id, accounting_entry_id)
);

create index idx_accounting_export_entries_org on accounting_export_entries (organization_id);
create index idx_accounting_export_entries_export on accounting_export_entries (accounting_export_id);
create index idx_accounting_export_entries_entry on accounting_export_entries (accounting_entry_id);

-- Settlement reports from Amazon/eBay/Yahoo/etc.
-- Used to reconcile orders, fees, refunds, and payouts.
create table settlement_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  channel_id uuid references channels (id) on delete set null,
  channel sales_channel not null,
  external_settlement_id text,
  status settlement_report_status not null default 'imported',
  settlement_start_date date,
  settlement_end_date date,
  deposit_date date,
  gross_sales_amount numeric(18, 2) not null default 0,
  fee_amount numeric(18, 2) not null default 0,
  refund_amount numeric(18, 2) not null default 0,
  adjustment_amount numeric(18, 2) not null default 0,
  net_deposit_amount numeric(18, 2) not null default 0,
  currency_code char(3) not null default 'JPY',
  raw_payload jsonb,
  imported_by_job_run_id uuid,
  imported_by_user_id uuid references users (id) on delete set null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint settlement_reports_unique_external unique (organization_id, channel, external_settlement_id)
);

create index idx_settlement_reports_org_status on settlement_reports (organization_id, status);
create index idx_settlement_reports_channel on settlement_reports (organization_id, channel);
create index idx_settlement_reports_deposit_date on settlement_reports (organization_id, deposit_date desc);

-- Cashflow snapshots for FP-style management.
-- Tracks cash in, cash out, inventory value, expected card payments, and settlement receivables.
create table cashflow_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  period_type cashflow_snapshot_period not null,
  period_start date not null,
  period_end date not null,
  cash_in_amount numeric(18, 2) not null default 0,
  cash_out_amount numeric(18, 2) not null default 0,
  net_cashflow_amount numeric(18, 2) not null default 0,
  inventory_cost_amount numeric(18, 2) not null default 0,
  expected_settlement_amount numeric(18, 2) not null default 0,
  expected_card_payment_amount numeric(18, 2) not null default 0,
  dead_stock_cost_amount numeric(18, 2) not null default 0,
  gross_profit_amount numeric(18, 2) not null default 0,
  gross_profit_margin numeric(8, 4),
  metadata jsonb not null default '{}'::jsonb,
  created_by_job_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint cashflow_snapshots_unique_period unique (organization_id, period_type, period_start, period_end)
);

create index idx_cashflow_snapshots_org_period on cashflow_snapshots (organization_id, period_type, period_start desc);

-- Tax summary reports for user/accountant review.
-- Does not perform filing or tax advice; stores aggregated numbers.
create table tax_summary_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  period_type tax_report_period not null,
  fiscal_year integer not null,
  period_start date not null,
  period_end date not null,
  sales_amount numeric(18, 2) not null default 0,
  purchase_amount numeric(18, 2) not null default 0,
  cost_of_goods_sold_amount numeric(18, 2) not null default 0,
  fee_amount numeric(18, 2) not null default 0,
  shipping_expense_amount numeric(18, 2) not null default 0,
  inventory_ending_amount numeric(18, 2) not null default 0,
  taxable_sales_amount numeric(18, 2) not null default 0,
  consumption_tax_estimate_amount numeric(18, 2) not null default 0,
  profit_estimate_amount numeric(18, 2) not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_job_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tax_summary_reports_unique_period unique (organization_id, period_type, fiscal_year, period_start, period_end)
);

create index idx_tax_summary_reports_org_period on tax_summary_reports (organization_id, fiscal_year, period_start desc);

create trigger trg_accounting_accounts_set_updated_at
before update on accounting_accounts
for each row execute function set_updated_at();

create trigger trg_accounting_entries_set_updated_at
before update on accounting_entries
for each row execute function set_updated_at();

create trigger trg_accounting_exports_set_updated_at
before update on accounting_exports
for each row execute function set_updated_at();

create trigger trg_settlement_reports_set_updated_at
before update on settlement_reports
for each row execute function set_updated_at();

create trigger trg_cashflow_snapshots_set_updated_at
before update on cashflow_snapshots
for each row execute function set_updated_at();

create trigger trg_tax_summary_reports_set_updated_at
before update on tax_summary_reports
for each row execute function set_updated_at();

alter table accounting_accounts enable row level security;
alter table accounting_entries enable row level security;
alter table accounting_exports enable row level security;
alter table accounting_export_entries enable row level security;
alter table settlement_reports enable row level security;
alter table cashflow_snapshots enable row level security;
alter table tax_summary_reports enable row level security;

create policy accounting_accounts_tenant_isolation on accounting_accounts
  using (organization_id = app.current_organization_id());

create policy accounting_entries_tenant_isolation on accounting_entries
  using (organization_id = app.current_organization_id());

create policy accounting_exports_tenant_isolation on accounting_exports
  using (organization_id = app.current_organization_id());

create policy accounting_export_entries_tenant_isolation on accounting_export_entries
  using (organization_id = app.current_organization_id());

create policy settlement_reports_tenant_isolation on settlement_reports
  using (organization_id = app.current_organization_id());

create policy cashflow_snapshots_tenant_isolation on cashflow_snapshots
  using (organization_id = app.current_organization_id());

create policy tax_summary_reports_tenant_isolation on tax_summary_reports
  using (organization_id = app.current_organization_id());

-- ============================================================
-- Source: db_schema_07_jobs_billing.sql
-- ============================================================

-- Sedori AI system DB schema v1
-- Section 07: Jobs / alerts / notifications / billing
-- Target: PostgreSQL
-- Depends on:
--   db_schema_01_tenant_users.sql
--   db_schema_02_api_security.sql
--   db_schema_03_products_market.sql
--   db_schema_04_inventory.sql
--   db_schema_05_sales_orders.sql
--   db_schema_06_accounting.sql

create type job_status as enum (
  'active',
  'paused',
  'disabled',
  'archived'
);

create type job_schedule_type as enum (
  'manual',
  'cron',
  'interval',
  'one_time',
  'event'
);

create type job_run_status as enum (
  'scheduled',
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'retrying',
  'timed_out',
  'skipped'
);

create type job_trigger_type as enum (
  'schedule',
  'manual',
  'retry',
  'event',
  'api',
  'system'
);

create type job_run_log_level as enum (
  'debug',
  'info',
  'warning',
  'error'
);

create type alert_status as enum (
  'active',
  'muted',
  'resolved',
  'disabled'
);

create type alert_severity as enum (
  'info',
  'warning',
  'critical'
);

create type notification_channel_type as enum (
  'email',
  'slack',
  'webhook',
  'line',
  'sms',
  'discord',
  'other'
);

create type notification_channel_status as enum (
  'active',
  'disabled',
  'error'
);

create type alert_delivery_status as enum (
  'pending',
  'sent',
  'failed',
  'skipped',
  'throttled'
);

create type billing_plan_status as enum (
  'active',
  'archived'
);

create type billing_interval as enum (
  'monthly',
  'yearly',
  'one_time'
);

create type billing_subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'paused',
  'cancelled',
  'unpaid'
);

create type billing_usage_limit_period as enum (
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'lifetime'
);

create type billing_usage_limit_scope as enum (
  'organization',
  'subscription',
  'plan',
  'job',
  'api'
);

create type billing_invoice_status as enum (
  'draft',
  'open',
  'paid',
  'void',
  'uncollectible',
  'failed'
);

create type billing_invoice_item_type as enum (
  'subscription',
  'usage',
  'adjustment',
  'discount',
  'tax',
  'other'
);

-- BullMQ job definitions. Redis owns queue execution; DB owns tenant-scoped
-- configuration, schedule metadata, retry policy, and next execution planning.
create table jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  queue_name text not null default 'default',
  job_key text not null,
  name text not null,
  description text,
  job_type text not null,
  status job_status not null default 'active',
  schedule_type job_schedule_type not null default 'manual',
  cron_expression text,
  repeat_interval_seconds integer,
  one_time_run_at timestamptz,
  timezone text not null default 'Asia/Tokyo',
  payload jsonb not null default '{}'::jsonb,
  priority integer not null default 0,
  concurrency_key text,
  max_concurrency integer not null default 1,
  timeout_seconds integer,
  max_attempts integer not null default 3,
  backoff_strategy text not null default 'exponential',
  backoff_delay_seconds integer not null default 60,
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_failed_at timestamptz,
  last_failure_reason text,
  created_by_user_id uuid references users (id) on delete set null,
  updated_by_user_id uuid references users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint jobs_unique_key unique (organization_id, queue_name, job_key),
  constraint jobs_repeat_interval_positive check (
    repeat_interval_seconds is null or repeat_interval_seconds > 0
  ),
  constraint jobs_max_concurrency_positive check (max_concurrency > 0),
  constraint jobs_timeout_seconds_positive check (
    timeout_seconds is null or timeout_seconds > 0
  ),
  constraint jobs_max_attempts_positive check (max_attempts > 0),
  constraint jobs_backoff_delay_non_negative check (backoff_delay_seconds >= 0)
);

create index idx_jobs_org_status on jobs (organization_id, status);
create index idx_jobs_type on jobs (organization_id, job_type);
create index idx_jobs_schedule on jobs (organization_id, schedule_type);
create index idx_jobs_next_run_at on jobs (organization_id, next_run_at)
  where deleted_at is null and status = 'active';
create index idx_jobs_concurrency_key on jobs (organization_id, concurrency_key);
create index idx_jobs_deleted_at on jobs (deleted_at);

-- Job execution history. Stores BullMQ ids, attempt counts, failures, worker
-- heartbeats, and payload snapshots for audit/debugging.
create table job_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  job_id uuid references jobs (id) on delete set null,
  bullmq_job_id text,
  queue_name text not null default 'default',
  run_key text,
  status job_run_status not null default 'scheduled',
  trigger_type job_trigger_type not null default 'schedule',
  scheduled_for timestamptz,
  enqueued_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  next_retry_at timestamptz,
  attempt_number integer not null default 1,
  max_attempts integer not null default 1,
  retry_count integer not null default 0,
  progress numeric(5, 2) not null default 0,
  heartbeat_at timestamptz,
  duration_ms integer,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb,
  failure_reason text,
  error_code text,
  error_stack text,
  worker_id text,
  created_by_user_id uuid references users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint job_runs_unique_bullmq_job unique (organization_id, queue_name, bullmq_job_id),
  constraint job_runs_unique_run_key unique (organization_id, run_key),
  constraint job_runs_attempt_number_positive check (attempt_number > 0),
  constraint job_runs_max_attempts_positive check (max_attempts > 0),
  constraint job_runs_retry_count_non_negative check (retry_count >= 0),
  constraint job_runs_progress_range check (progress >= 0 and progress <= 100),
  constraint job_runs_duration_non_negative check (
    duration_ms is null or duration_ms >= 0
  )
);

create index idx_job_runs_org_status on job_runs (organization_id, status);
create index idx_job_runs_job_status on job_runs (job_id, status);
create index idx_job_runs_scheduled_for on job_runs (organization_id, scheduled_for);
create index idx_job_runs_next_retry_at on job_runs (organization_id, next_retry_at)
  where deleted_at is null and status = 'retrying';
create index idx_job_runs_created_at on job_runs (organization_id, created_at desc);
create index idx_job_runs_finished_at on job_runs (organization_id, finished_at desc);
create index idx_job_runs_deleted_at on job_runs (deleted_at);

create table job_run_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  job_run_id uuid not null references job_runs (id) on delete cascade,
  job_id uuid references jobs (id) on delete set null,
  level job_run_log_level not null default 'info',
  message text not null,
  context jsonb not null default '{}'::jsonb,
  error_code text,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_job_run_logs_org on job_run_logs (organization_id);
create index idx_job_run_logs_run_logged_at on job_run_logs (job_run_id, logged_at);
create index idx_job_run_logs_job on job_run_logs (job_id);
create index idx_job_run_logs_level on job_run_logs (organization_id, level);
create index idx_job_run_logs_deleted_at on job_run_logs (deleted_at);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  description text,
  severity alert_severity not null default 'warning',
  status alert_status not null default 'active',
  source_type text not null,
  source_resource_id uuid,
  condition_type text not null,
  condition_config jsonb not null default '{}'::jsonb,
  dedupe_key text,
  threshold_value numeric(18, 6),
  evaluation_window_seconds integer,
  cooldown_seconds integer not null default 3600,
  last_evaluated_at timestamptz,
  last_triggered_at timestamptz,
  last_resolved_at timestamptz,
  muted_until timestamptz,
  created_by_user_id uuid references users (id) on delete set null,
  updated_by_user_id uuid references users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint alerts_unique_name unique (organization_id, name),
  constraint alerts_evaluation_window_positive check (
    evaluation_window_seconds is null or evaluation_window_seconds > 0
  ),
  constraint alerts_cooldown_non_negative check (cooldown_seconds >= 0)
);

create index idx_alerts_org_status on alerts (organization_id, status);
create index idx_alerts_severity on alerts (organization_id, severity);
create index idx_alerts_source on alerts (source_type, source_resource_id);
create index idx_alerts_dedupe_key on alerts (organization_id, dedupe_key);
create index idx_alerts_last_triggered_at on alerts (organization_id, last_triggered_at desc);
create index idx_alerts_deleted_at on alerts (deleted_at);

create table notification_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  channel_type notification_channel_type not null,
  name text not null,
  status notification_channel_status not null default 'active',
  destination text,
  config jsonb not null default '{}'::jsonb,
  encrypted_secret_config bytea,
  last_verified_at timestamptz,
  last_error_message text,
  created_by_user_id uuid references users (id) on delete set null,
  updated_by_user_id uuid references users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint notification_channels_unique_name unique (organization_id, name)
);

create index idx_notification_channels_org_status on notification_channels (organization_id, status);
create index idx_notification_channels_type on notification_channels (organization_id, channel_type);
create index idx_notification_channels_deleted_at on notification_channels (deleted_at);

create table alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  alert_id uuid not null references alerts (id) on delete cascade,
  notification_channel_id uuid references notification_channels (id) on delete set null,
  job_run_id uuid references job_runs (id) on delete set null,
  status alert_delivery_status not null default 'pending',
  severity alert_severity not null,
  dedupe_key text,
  title text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  skipped_at timestamptz,
  failure_reason text,
  external_delivery_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint alert_deliveries_attempt_count_non_negative check (attempt_count >= 0),
  constraint alert_deliveries_max_attempts_positive check (max_attempts > 0)
);

create index idx_alert_deliveries_org_status on alert_deliveries (organization_id, status);
create index idx_alert_deliveries_alert on alert_deliveries (alert_id);
create index idx_alert_deliveries_channel on alert_deliveries (notification_channel_id);
create index idx_alert_deliveries_job_run on alert_deliveries (job_run_id);
create index idx_alert_deliveries_scheduled_at on alert_deliveries (organization_id, scheduled_at);
create index idx_alert_deliveries_dedupe_key on alert_deliveries (organization_id, dedupe_key);
create index idx_alert_deliveries_deleted_at on alert_deliveries (deleted_at);

-- Organization-scoped plan catalog. This supports custom plans and imported
-- external price ids while keeping tenant isolation consistent.
create table billing_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  plan_code text not null,
  name text not null,
  description text,
  status billing_plan_status not null default 'active',
  billing_interval billing_interval not null default 'monthly',
  price_amount numeric(18, 2) not null default 0,
  currency_code char(3) not null default 'JPY',
  trial_days integer not null default 0,
  external_product_id text,
  external_price_id text,
  features jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint billing_plans_unique_code unique (organization_id, plan_code),
  constraint billing_plans_price_non_negative check (price_amount >= 0),
  constraint billing_plans_trial_days_non_negative check (trial_days >= 0)
);

create index idx_billing_plans_org_status on billing_plans (organization_id, status);
create index idx_billing_plans_interval on billing_plans (organization_id, billing_interval);
create index idx_billing_plans_deleted_at on billing_plans (deleted_at);

create table billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  billing_plan_id uuid references billing_plans (id) on delete set null,
  status billing_subscription_status not null default 'trialing',
  external_customer_id text,
  external_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  paused_at timestamptz,
  seats integer not null default 1,
  unit_amount numeric(18, 2) not null default 0,
  currency_code char(3) not null default 'JPY',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint billing_subscriptions_unique_external
    unique (organization_id, external_subscription_id),
  constraint billing_subscriptions_seats_positive check (seats > 0),
  constraint billing_subscriptions_unit_amount_non_negative check (unit_amount >= 0)
);

create index idx_billing_subscriptions_org_status on billing_subscriptions (organization_id, status);
create index idx_billing_subscriptions_plan on billing_subscriptions (billing_plan_id);
create index idx_billing_subscriptions_current_period on billing_subscriptions (
  organization_id,
  current_period_start,
  current_period_end
);
create index idx_billing_subscriptions_deleted_at on billing_subscriptions (deleted_at);

-- Limits and counters used by schedulers/workers before enqueuing expensive work.
-- Plan rows define defaults; subscription rows can hold overrides and live usage.
create table billing_usage_limits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  billing_plan_id uuid references billing_plans (id) on delete cascade,
  billing_subscription_id uuid references billing_subscriptions (id) on delete cascade,
  limit_key text not null,
  limit_name text not null,
  scope billing_usage_limit_scope not null default 'organization',
  period billing_usage_limit_period not null default 'monthly',
  unit text not null default 'count',
  limit_quantity numeric(18, 6) not null,
  used_quantity numeric(18, 6) not null default 0,
  reserved_quantity numeric(18, 6) not null default 0,
  period_start timestamptz,
  period_end timestamptz,
  soft_limit_ratio numeric(8, 4) not null default 0.8,
  hard_limit_enforced boolean not null default true,
  reset_at timestamptz,
  last_consumed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint billing_usage_limits_quantity_non_negative check (limit_quantity >= 0),
  constraint billing_usage_limits_used_non_negative check (used_quantity >= 0),
  constraint billing_usage_limits_reserved_non_negative check (reserved_quantity >= 0),
  constraint billing_usage_limits_soft_ratio_range check (
    soft_limit_ratio >= 0 and soft_limit_ratio <= 1
  ),
  constraint billing_usage_limits_period_order check (
    period_start is null or period_end is null or period_start < period_end
  )
);

create index idx_billing_usage_limits_org_key on billing_usage_limits (organization_id, limit_key);
create index idx_billing_usage_limits_plan on billing_usage_limits (billing_plan_id);
create index idx_billing_usage_limits_subscription on billing_usage_limits (billing_subscription_id);
create index idx_billing_usage_limits_period on billing_usage_limits (
  organization_id,
  period,
  period_start,
  period_end
);
create index idx_billing_usage_limits_reset_at on billing_usage_limits (organization_id, reset_at);
create index idx_billing_usage_limits_deleted_at on billing_usage_limits (deleted_at);

create table billing_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  billing_subscription_id uuid references billing_subscriptions (id) on delete set null,
  invoice_number text not null,
  status billing_invoice_status not null default 'draft',
  external_invoice_id text,
  period_start timestamptz,
  period_end timestamptz,
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  subtotal_amount numeric(18, 2) not null default 0,
  tax_amount numeric(18, 2) not null default 0,
  discount_amount numeric(18, 2) not null default 0,
  total_amount numeric(18, 2) not null default 0,
  amount_paid numeric(18, 2) not null default 0,
  amount_due numeric(18, 2) not null default 0,
  currency_code char(3) not null default 'JPY',
  hosted_invoice_url text,
  invoice_pdf_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint billing_invoices_unique_number unique (organization_id, invoice_number),
  constraint billing_invoices_unique_external unique (organization_id, external_invoice_id),
  constraint billing_invoices_period_order check (
    period_start is null or period_end is null or period_start < period_end
  ),
  constraint billing_invoices_amounts_non_negative check (
    subtotal_amount >= 0
    and tax_amount >= 0
    and discount_amount >= 0
    and total_amount >= 0
    and amount_paid >= 0
    and amount_due >= 0
  )
);

create index idx_billing_invoices_org_status on billing_invoices (organization_id, status);
create index idx_billing_invoices_subscription on billing_invoices (billing_subscription_id);
create index idx_billing_invoices_due_at on billing_invoices (organization_id, due_at);
create index idx_billing_invoices_issued_at on billing_invoices (organization_id, issued_at desc);
create index idx_billing_invoices_deleted_at on billing_invoices (deleted_at);

create table billing_invoice_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  billing_invoice_id uuid not null references billing_invoices (id) on delete cascade,
  billing_subscription_id uuid references billing_subscriptions (id) on delete set null,
  billing_usage_limit_id uuid references billing_usage_limits (id) on delete set null,
  item_type billing_invoice_item_type not null default 'subscription',
  description text not null,
  quantity numeric(18, 6) not null default 1,
  unit_amount numeric(18, 6) not null default 0,
  amount numeric(18, 2) not null,
  currency_code char(3) not null default 'JPY',
  period_start timestamptz,
  period_end timestamptz,
  source_resource_type text,
  source_resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint billing_invoice_items_quantity_non_negative check (quantity >= 0),
  constraint billing_invoice_items_period_order check (
    period_start is null or period_end is null or period_start < period_end
  )
);

create index idx_billing_invoice_items_org on billing_invoice_items (organization_id);
create index idx_billing_invoice_items_invoice on billing_invoice_items (billing_invoice_id);
create index idx_billing_invoice_items_subscription on billing_invoice_items (billing_subscription_id);
create index idx_billing_invoice_items_usage_limit on billing_invoice_items (billing_usage_limit_id);
create index idx_billing_invoice_items_source on billing_invoice_items (source_resource_type, source_resource_id);
create index idx_billing_invoice_items_deleted_at on billing_invoice_items (deleted_at);

create trigger trg_jobs_set_updated_at
before update on jobs
for each row execute function set_updated_at();

create trigger trg_job_runs_set_updated_at
before update on job_runs
for each row execute function set_updated_at();

create trigger trg_job_run_logs_set_updated_at
before update on job_run_logs
for each row execute function set_updated_at();

create trigger trg_alerts_set_updated_at
before update on alerts
for each row execute function set_updated_at();

create trigger trg_notification_channels_set_updated_at
before update on notification_channels
for each row execute function set_updated_at();

create trigger trg_alert_deliveries_set_updated_at
before update on alert_deliveries
for each row execute function set_updated_at();

create trigger trg_billing_plans_set_updated_at
before update on billing_plans
for each row execute function set_updated_at();

create trigger trg_billing_subscriptions_set_updated_at
before update on billing_subscriptions
for each row execute function set_updated_at();

create trigger trg_billing_usage_limits_set_updated_at
before update on billing_usage_limits
for each row execute function set_updated_at();

create trigger trg_billing_invoices_set_updated_at
before update on billing_invoices
for each row execute function set_updated_at();

create trigger trg_billing_invoice_items_set_updated_at
before update on billing_invoice_items
for each row execute function set_updated_at();

alter table jobs enable row level security;
alter table job_runs enable row level security;
alter table job_run_logs enable row level security;
alter table alerts enable row level security;
alter table notification_channels enable row level security;
alter table alert_deliveries enable row level security;
alter table billing_plans enable row level security;
alter table billing_subscriptions enable row level security;
alter table billing_usage_limits enable row level security;
alter table billing_invoices enable row level security;
alter table billing_invoice_items enable row level security;

create policy jobs_tenant_isolation on jobs
  using (organization_id = app.current_organization_id());

create policy job_runs_tenant_isolation on job_runs
  using (organization_id = app.current_organization_id());

create policy job_run_logs_tenant_isolation on job_run_logs
  using (organization_id = app.current_organization_id());

create policy alerts_tenant_isolation on alerts
  using (organization_id = app.current_organization_id());

create policy notification_channels_tenant_isolation on notification_channels
  using (organization_id = app.current_organization_id());

create policy alert_deliveries_tenant_isolation on alert_deliveries
  using (organization_id = app.current_organization_id());

create policy billing_plans_tenant_isolation on billing_plans
  using (organization_id = app.current_organization_id());

create policy billing_subscriptions_tenant_isolation on billing_subscriptions
  using (organization_id = app.current_organization_id());

create policy billing_usage_limits_tenant_isolation on billing_usage_limits
  using (organization_id = app.current_organization_id());

create policy billing_invoices_tenant_isolation on billing_invoices
  using (organization_id = app.current_organization_id());

create policy billing_invoice_items_tenant_isolation on billing_invoice_items
  using (organization_id = app.current_organization_id());

-- ============================================================
-- Source: db_schema_08_security_hardening.sql
-- ============================================================

-- Sedori AI system DB schema v1
-- Section 08: Security hardening / cross-tenant FK guards / RLS additions
-- Target: PostgreSQL
-- Depends on:
--   db_schema_01_tenant_users.sql
--   db_schema_02_api_security.sql
--   db_schema_03_products_market.sql
--   db_schema_04_inventory.sql
--   db_schema_05_sales_orders.sql
--   db_schema_06_accounting.sql
--   db_schema_07_jobs_billing.sql

-- Current user helper for RLS on user/session tables.
create or replace function app.current_user_id()
returns uuid as $$
declare
  uid text;
begin
  uid := nullif(current_setting('app.current_user_id', true), '');
  if uid is null then
    return null;
  end if;

  return uid::uuid;
exception when invalid_text_representation then
  return null;
end;
$$ language plpgsql stable;

-- Baseline unique keys used by composite foreign keys.
-- These let child rows verify that referenced parent rows belong to the same organization.
alter table products add constraint products_org_id_unique unique (organization_id, id);
alter table api_credentials add constraint api_credentials_org_id_unique unique (organization_id, id);
alter table channel_product_matches add constraint channel_product_matches_org_id_unique unique (organization_id, id);
alter table market_prices add constraint market_prices_org_id_unique unique (organization_id, id);
alter table channels add constraint channels_org_id_unique unique (organization_id, id);
alter table listings add constraint listings_org_id_unique unique (organization_id, id);
alter table orders add constraint orders_org_id_unique unique (organization_id, id);
alter table order_items add constraint order_items_org_id_unique unique (organization_id, id);
alter table fees add constraint fees_org_id_unique unique (organization_id, id);
alter table shipments add constraint shipments_org_id_unique unique (organization_id, id);
alter table returns add constraint returns_org_id_unique unique (organization_id, id);
alter table purchase_orders add constraint purchase_orders_org_id_unique unique (organization_id, id);
alter table purchase_order_items add constraint purchase_order_items_org_id_unique unique (organization_id, id);
alter table inventory_items add constraint inventory_items_org_id_unique unique (organization_id, id);
alter table receipts add constraint receipts_org_id_unique unique (organization_id, id);
alter table accounting_accounts add constraint accounting_accounts_org_id_unique unique (organization_id, id);
alter table accounting_entries add constraint accounting_entries_org_id_unique unique (organization_id, id);
alter table accounting_exports add constraint accounting_exports_org_id_unique unique (organization_id, id);
alter table settlement_reports add constraint settlement_reports_org_id_unique unique (organization_id, id);
alter table jobs add constraint jobs_org_id_unique unique (organization_id, id);
alter table job_runs add constraint job_runs_org_id_unique unique (organization_id, id);
alter table alerts add constraint alerts_org_id_unique unique (organization_id, id);
alter table billing_subscriptions add constraint billing_subscriptions_org_id_unique unique (organization_id, id);
alter table billing_invoices add constraint billing_invoices_org_id_unique unique (organization_id, id);

-- Product and market composite FK guards.
alter table product_identifiers
  add constraint product_identifiers_product_same_org
  foreign key (organization_id, product_id) references products (organization_id, id);

alter table channel_product_matches
  add constraint channel_product_matches_product_same_org
  foreign key (organization_id, product_id) references products (organization_id, id);

alter table sourcing_candidates
  add constraint sourcing_candidates_product_same_org
  foreign key (organization_id, product_id) references products (organization_id, id);

alter table ai_scores
  add constraint ai_scores_product_same_org
  foreign key (organization_id, product_id) references products (organization_id, id);

alter table cross_channel_opportunities
  add constraint cross_channel_opportunities_product_same_org
  foreign key (organization_id, product_id) references products (organization_id, id);

alter table cross_channel_opportunities
  add constraint cross_channel_opportunities_buy_match_same_org
  foreign key (organization_id, buy_match_id) references channel_product_matches (organization_id, id);

alter table cross_channel_opportunities
  add constraint cross_channel_opportunities_sell_match_same_org
  foreign key (organization_id, sell_match_id) references channel_product_matches (organization_id, id);

alter table cross_channel_opportunities
  add constraint cross_channel_opportunities_buy_price_same_org
  foreign key (organization_id, buy_market_price_id) references market_prices (organization_id, id);

alter table cross_channel_opportunities
  add constraint cross_channel_opportunities_sell_price_same_org
  foreign key (organization_id, sell_market_price_id) references market_prices (organization_id, id);

-- API credential access same-org guard.
alter table api_credential_access_logs
  add constraint api_credential_access_logs_credential_same_org
  foreign key (organization_id, api_credential_id) references api_credentials (organization_id, id);

-- Sales/inventory/accounting FK guards most likely to cause cross-tenant leakage.
alter table listings
  add constraint listings_channel_same_org
  foreign key (organization_id, channel_id) references channels (organization_id, id);

alter table listings
  add constraint listings_inventory_item_same_org
  foreign key (organization_id, inventory_item_id) references inventory_items (organization_id, id);

alter table order_items
  add constraint order_items_inventory_item_same_org
  foreign key (organization_id, inventory_item_id) references inventory_items (organization_id, id);

alter table returns
  add constraint returns_inventory_item_same_org
  foreign key (organization_id, inventory_item_id) references inventory_items (organization_id, id);

alter table orders
  add constraint orders_channel_same_org
  foreign key (organization_id, channel_id) references channels (organization_id, id);

alter table order_items
  add constraint order_items_order_same_org
  foreign key (organization_id, order_id) references orders (organization_id, id);

alter table fees
  add constraint fees_order_same_org
  foreign key (organization_id, order_id) references orders (organization_id, id);

alter table shipments
  add constraint shipments_order_same_org
  foreign key (organization_id, order_id) references orders (organization_id, id);

alter table accounting_entries
  add constraint accounting_entries_order_same_org
  foreign key (organization_id, order_id) references orders (organization_id, id);

alter table accounting_entries
  add constraint accounting_entries_inventory_item_same_org
  foreign key (organization_id, inventory_item_id) references inventory_items (organization_id, id);

alter table accounting_entries
  add constraint accounting_entries_fee_same_org
  foreign key (organization_id, fee_id) references fees (organization_id, id);

alter table accounting_entries
  add constraint accounting_entries_debit_account_same_org
  foreign key (organization_id, debit_account_id) references accounting_accounts (organization_id, id);

alter table accounting_entries
  add constraint accounting_entries_credit_account_same_org
  foreign key (organization_id, credit_account_id) references accounting_accounts (organization_id, id);

alter table job_runs
  add constraint job_runs_job_same_org
  foreign key (organization_id, job_id) references jobs (organization_id, id);

-- Job-run FK guards for records created by scheduled workers.
alter table api_credential_access_logs
  add constraint api_credential_access_logs_job_run_same_org
  foreign key (organization_id, job_run_id) references job_runs (organization_id, id);

alter table sourcing_candidates
  add constraint sourcing_candidates_job_run_same_org
  foreign key (organization_id, discovered_by_job_run_id) references job_runs (organization_id, id);

alter table cross_channel_opportunities
  add constraint cross_channel_opportunities_job_run_same_org
  foreign key (organization_id, discovered_by_job_run_id) references job_runs (organization_id, id);

alter table ai_scores
  add constraint ai_scores_job_run_same_org
  foreign key (organization_id, created_by_job_run_id) references job_runs (organization_id, id);

alter table accounting_entries
  add constraint accounting_entries_job_run_same_org
  foreign key (organization_id, created_by_job_run_id) references job_runs (organization_id, id);

alter table settlement_reports
  add constraint settlement_reports_job_run_same_org
  foreign key (organization_id, imported_by_job_run_id) references job_runs (organization_id, id);

alter table cashflow_snapshots
  add constraint cashflow_snapshots_job_run_same_org
  foreign key (organization_id, created_by_job_run_id) references job_runs (organization_id, id);

alter table tax_summary_reports
  add constraint tax_summary_reports_job_run_same_org
  foreign key (organization_id, created_by_job_run_id) references job_runs (organization_id, id);

-- Tenant and user RLS for base tables.
alter table users enable row level security;
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table organization_invitations enable row level security;
alter table sessions enable row level security;
alter table login_events enable row level security;

create policy users_self_access on users
  using (id = app.current_user_id());

create policy organizations_member_access on organizations
  using (
    exists (
      select 1
      from organization_members om
      where om.organization_id = organizations.id
        and om.user_id = app.current_user_id()
        and om.status = 'active'
        and om.deleted_at is null
    )
  );

create policy organization_members_tenant_isolation on organization_members
  using (organization_id = app.current_organization_id());

create policy organization_invitations_tenant_isolation on organization_invitations
  using (organization_id = app.current_organization_id());

create policy sessions_self_access on sessions
  using (user_id = app.current_user_id());

create policy login_events_self_access on login_events
  using (user_id = app.current_user_id());

-- Do not expose global audit/security rows to tenant users.
drop policy if exists audit_logs_tenant_isolation on audit_logs;
drop policy if exists security_events_tenant_isolation on security_events;

create policy audit_logs_tenant_isolation on audit_logs
  using (organization_id = app.current_organization_id());

create policy security_events_tenant_isolation on security_events
  using (organization_id = app.current_organization_id());

-- Core check constraints for amounts and quantities.
alter table order_items add constraint order_items_quantity_positive check (quantity > 0);
alter table order_items add constraint order_items_amounts_nonnegative check (unit_price_amount >= 0 and subtotal_amount >= 0 and tax_amount >= 0);
alter table orders add constraint orders_amounts_nonnegative check (subtotal_amount >= 0 and shipping_amount >= 0 and discount_amount >= 0 and tax_amount >= 0 and total_amount >= 0);
alter table shipments add constraint shipments_shipping_cost_nonnegative check (shipping_cost_amount is null or shipping_cost_amount >= 0);
alter table accounting_entries add constraint accounting_entries_amount_nonnegative check (amount >= 0 and tax_amount >= 0);
alter table accounting_entries add constraint accounting_entries_accounts_distinct check (
  debit_account_id is null
  or credit_account_id is null
  or debit_account_id is distinct from credit_account_id
);
