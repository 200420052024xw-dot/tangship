-- Admin/Supabase schema parity migration.
-- Safe to run repeatedly in the Supabase SQL editor.

create extension if not exists pgcrypto;

alter table if exists public.orders add column if not exists mode varchar(20) not null default 'single';
alter table if exists public.orders add column if not exists scheduled_end_at timestamptz;
alter table if exists public.orders add column if not exists internal_note text;
alter table if exists public.orders add column if not exists user_note text;
alter table if exists public.orders add column if not exists reserved_vehicle_count integer not null default 0;
alter table if exists public.orders add column if not exists dispatch_note text;
alter table if exists public.orders add column if not exists dispatch_vehicle_count integer not null default 0;
alter table if exists public.orders add column if not exists vehicle_plate varchar(32);
alter table if exists public.orders add column if not exists completion_note text;
alter table if exists public.orders add column if not exists completion_proof_url text;

alter table if exists public.vehicle_catalog add column if not exists service_mode varchar(20) not null default 'single';
alter table if exists public.vehicle_catalog add column if not exists total_count integer not null default 0;
create index if not exists vehicle_catalog_service_mode_idx on public.vehicle_catalog(service_mode);

alter table if exists public.admin_users add column if not exists nickname varchar(64) not null default '';
update public.admin_users set nickname=username where nickname='';
-- 财务角色已合并至运营；保留账号和微信绑定，不删除历史数据。
update public.admin_users set role='operator', updated_at=now() where role='finance';

alter table if exists public.admin_wechat_bindings add column if not exists granted_by varchar(36);
alter table if exists public.admin_wechat_bindings add column if not exists updated_at timestamptz not null default now();
alter table if exists public.admin_wechat_bindings add column if not exists revoked_at timestamptz;

alter table if exists public.audit_logs add column if not exists target_type varchar(32);
alter table if exists public.audit_logs add column if not exists target_id varchar(36);
alter table if exists public.audit_logs add column if not exists detail text;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='resource_type') then
    execute 'update public.audit_logs set target_type=coalesce(target_type,resource_type) where target_type is null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='resource_id') then
    execute 'update public.audit_logs set target_id=coalesce(target_id,resource_id) where target_id is null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='detail_json') then
    execute 'update public.audit_logs set detail=coalesce(detail,detail_json) where detail is null';
  end if;
end $$;

update public.audit_logs set target_type='unknown' where target_type is null;
update public.audit_logs set target_id=id where target_id is null;
update public.audit_logs set detail='{}' where detail is null;
alter table if exists public.audit_logs alter column target_type set not null;
alter table if exists public.audit_logs alter column target_id set not null;
alter table if exists public.audit_logs alter column detail set not null;
create index if not exists audit_logs_target_idx on public.audit_logs(target_type,target_id);

create table if not exists public.inquiries (
  id varchar(36) primary key default gen_random_uuid()::text,
  type varchar(20) not null,
  vehicle_id varchar(36),
  sender_address text,
  receiver_address text,
  cargo_type varchar(64),
  delivery_cycle varchar(64),
  monthly_trips integer,
  contact_name varchar(64) not null,
  phone varchar(32) not null,
  company_name varchar(128),
  consult_content text,
  status varchar(20) not null default 'pending',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inquiries_type_idx on public.inquiries(type);
create index if not exists inquiries_status_idx on public.inquiries(status);

create table if not exists public.contact_settings (
  id varchar(36) primary key default gen_random_uuid()::text,
  phone varchar(32) not null default '',
  wechat varchar(64) not null default '',
  email varchar(128) not null default '',
  work_time varchar(128) not null default '工作日 9:00-18:00',
  extra_text text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_notifications (
  id varchar(36) primary key default gen_random_uuid()::text,
  admin_user_id varchar(36) references public.admin_users(id) on delete cascade,
  type varchar(40) not null,
  title varchar(128) not null,
  content text not null,
  target_path varchar(256),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists admin_notifications_admin_read_idx on public.admin_notifications(admin_user_id,read_at);
create index if not exists admin_notifications_created_idx on public.admin_notifications(created_at desc);

-- Verification queries: each should return the expected columns/tables.
select column_name from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name in ('target_type','target_id','detail') order by column_name;
select table_name from information_schema.tables where table_schema='public' and table_name in ('inquiries','contact_settings','admin_notifications') order by table_name;
