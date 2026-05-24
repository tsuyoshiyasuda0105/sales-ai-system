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
