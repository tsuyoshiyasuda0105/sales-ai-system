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

