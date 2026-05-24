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

