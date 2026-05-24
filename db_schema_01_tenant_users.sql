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

