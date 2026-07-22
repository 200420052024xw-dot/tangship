-- 为现有冷藏车型补充显式冷藏能力标记。
-- specs_json 为文本化 JSON，保持原有字段不变，仅追加 supportsRefrigeration。
update public.vehicle_catalog
set
  specs_json = jsonb_set(
    coalesce(nullif(specs_json, '')::jsonb, '{}'::jsonb),
    '{supportsRefrigeration}',
    'true'::jsonb,
    true
  )::text,
  updated_at = now()
where id in ('z5-c', 'z5-c-monthly', 'z8-max-c', 'z8-max-c-monthly');
