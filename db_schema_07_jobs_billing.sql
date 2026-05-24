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
