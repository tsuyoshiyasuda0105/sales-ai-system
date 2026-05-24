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
