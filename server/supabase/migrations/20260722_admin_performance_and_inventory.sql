-- Admin performance, vehicle inventory, notification and audit parity.
-- Idempotent: safe to apply more than once.

create extension if not exists pgcrypto;

alter table if exists public.admin_users
  add column if not exists nickname varchar(64) not null default '';

update public.admin_users
set nickname = username
where nickname = '';

alter table if exists public.vehicle_catalog
  add column if not exists total_count integer not null default 1;

alter table if exists public.vehicle_catalog
  alter column total_count set default 1;

update public.vehicle_catalog
set total_count = 1
where total_count is null;

alter table if exists public.vehicle_catalog
  drop constraint if exists vehicle_catalog_total_count_check;
alter table if exists public.vehicle_catalog
  add constraint vehicle_catalog_total_count_check check (total_count >= 0);

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

insert into public.audit_logs (id, admin_user_id, action, target_type, target_id, detail, created_at)
select
  gen_random_uuid()::text,
  orders.reviewed_by,
  case when orders.status = 'rejected' or orders.rejection_reason is not null then 'order.reject' else 'order.approve' end,
  'order',
  orders.id,
  jsonb_build_object(
    'backfilled', true,
    'totalCents', (
      select quote.total_cents
      from public.order_quotes quote
      where quote.order_id = orders.id
      order by quote.created_at desc
      limit 1
    ),
    'rejectionReason', orders.rejection_reason
  )::text,
  orders.reviewed_at
from public.orders orders
where orders.reviewed_by is not null
  and orders.reviewed_at is not null
  and not exists (
    select 1
    from public.audit_logs audit
    where audit.target_type = 'order'
      and audit.target_id = orders.id
      and audit.action in ('order.approve', 'order.reject')
  );

alter table if exists public.admin_notifications add column if not exists order_id varchar(36);
alter table if exists public.admin_notifications add column if not exists order_status varchar(40);
create index if not exists admin_notifications_order_idx on public.admin_notifications(order_id);

update public.admin_notifications
set order_id = substring(target_path from '^/orders/([^/]+)$')
where order_id is null and target_path ~ '^/orders/[^/]+$';

update public.admin_notifications
set order_status = nullif(split_part(content, '已更新为 ', 2), '')
where order_status is null and content like '%已更新为 %';
