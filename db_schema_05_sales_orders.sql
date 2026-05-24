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

