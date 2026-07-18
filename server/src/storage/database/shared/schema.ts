import { pgTable, varchar, text, integer, numeric, boolean, timestamp, index, uniqueIndex, serial } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// System table (must keep)
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ─── Users & Auth ───
export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  openid: varchar("openid", { length: 128 }).unique(),
  nickname: varchar("nickname", { length: 64 }).notNull().default(''),
  avatar_url: text("avatar_url"),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userSessions = pgTable("user_sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  token_hash: varchar("token_hash", { length: 128 }).notNull().unique(),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  revoked_at: timestamp("revoked_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("sessions_user_idx").on(t.user_id)]);

export const adminUsers = pgTable("admin_users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 64 }).notNull().unique(),
  password_hash: varchar("password_hash", { length: 256 }).notNull(),
  role: varchar("role", { length: 32 }).notNull().default('reviewer'),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const adminSessions = pgTable("admin_sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  admin_user_id: varchar("admin_user_id", { length: 36 }).notNull().references(() => adminUsers.id, { onDelete: 'cascade' }),
  token_hash: varchar("token_hash", { length: 128 }).notNull().unique(),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  revoked_at: timestamp("revoked_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("admin_sessions_admin_idx").on(t.admin_user_id)]);

export const adminWechatBindings = pgTable("admin_wechat_bindings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  admin_user_id: varchar("admin_user_id", { length: 36 }).notNull().references(() => adminUsers.id, { onDelete: 'cascade' }),
  user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  granted_by: varchar("granted_by", { length: 36 }).notNull().references(() => adminUsers.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  revoked_at: timestamp("revoked_at", { withTimezone: true }),
}, t => [
  uniqueIndex("admin_wechat_admin_uq").on(t.admin_user_id),
  uniqueIndex("admin_wechat_user_uq").on(t.user_id),
]);

// ─── Addresses ───
export const addresses = pgTable("addresses", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  contact_name: varchar("contact_name", { length: 64 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  province: varchar("province", { length: 64 }).notNull().default(''),
  city: varchar("city", { length: 64 }).notNull().default(''),
  district: varchar("district", { length: 64 }).notNull().default(''),
  poi_name: varchar("poi_name", { length: 128 }).notNull().default(''),
  formatted_address: varchar("formatted_address", { length: 256 }).notNull(),
  detail_address: varchar("detail_address", { length: 256 }).notNull().default(''),
  longitude: numeric("longitude", { precision: 10, scale: 6 }).notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 6 }).notNull(),
  usage_type: varchar("usage_type", { length: 20 }).notNull(),
  is_default_sender: boolean("is_default_sender").notNull().default(false),
  is_default_receiver: boolean("is_default_receiver").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  migration_key: varchar("migration_key", { length: 64 }),
}, t => [
  index("addresses_user_idx").on(t.user_id),
  uniqueIndex("addresses_user_migration_uq").on(t.user_id, t.migration_key),
]);

// ─── Orders ───
export const orders = pgTable("orders", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  order_no: varchar("order_no", { length: 32 }).notNull().unique(),
  user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  vehicle_id: varchar("vehicle_id", { length: 36 }).notNull(),
  mode: varchar("mode", { length: 20 }).notNull().default('single'),
  status: varchar("status", { length: 32 }).notNull(),
  pickup_type: varchar("pickup_type", { length: 32 }).notNull(),
  scheduled_at: timestamp("scheduled_at", { withTimezone: true }),
  scheduled_end_at: timestamp("scheduled_end_at", { withTimezone: true }),
  customer_remark: text("customer_remark"),
  reviewed_by: varchar("reviewed_by", { length: 36 }).references(() => adminUsers.id),
  reviewed_at: timestamp("reviewed_at", { withTimezone: true }),
  rejection_reason: text("rejection_reason"),
  internal_note: text("internal_note"),
  user_note: text("user_note"),
  idempotency_key: varchar("idempotency_key", { length: 64 }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [
  uniqueIndex("orders_user_idempotency_uq").on(t.user_id, t.idempotency_key),
  index("orders_user_idx").on(t.user_id),
  index("orders_status_idx").on(t.status),
]);

export const orderAddresses = pgTable("order_addresses", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  order_id: varchar("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: 'cascade' }),
  role: varchar("role", { length: 16 }).notNull(),
  contact_name: varchar("contact_name", { length: 64 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  province: varchar("province", { length: 64 }).notNull(),
  city: varchar("city", { length: 64 }).notNull(),
  district: varchar("district", { length: 64 }).notNull(),
  poi_name: varchar("poi_name", { length: 128 }).notNull(),
  formatted_address: varchar("formatted_address", { length: 256 }).notNull(),
  detail_address: varchar("detail_address", { length: 256 }).notNull(),
  longitude: numeric("longitude", { precision: 10, scale: 6 }).notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 6 }).notNull(),
}, t => [
  uniqueIndex("order_address_role_uq").on(t.order_id, t.role),
  index("order_addresses_order_idx").on(t.order_id),
]);

export const orderItems = pgTable("order_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  order_id: varchar("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: 'cascade' }),
  category: varchar("category", { length: 32 }).notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  quantity: integer("quantity").notNull(),
  estimated_weight_kg: numeric("estimated_weight_kg", { precision: 8, scale: 2 }).notNull(),
  length_mm: integer("length_mm"),
  width_mm: integer("width_mm"),
  height_mm: integer("height_mm"),
  fragile: boolean("fragile").notNull().default(false),
  oversized: boolean("oversized").notNull().default(false),
  need_carry: boolean("need_carry").notNull().default(false),
  remark: text("remark"),
}, t => [index("order_items_order_idx").on(t.order_id)]);

export const orderQuotes = pgTable("order_quotes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  order_id: varchar("order_id", { length: 36 }).notNull().references(() => orders.id),
  base_fee_cents: integer("base_fee_cents").notNull(),
  distance_fee_cents: integer("distance_fee_cents").notNull(),
  vehicle_fee_cents: integer("vehicle_fee_cents").notNull(),
  service_fee_cents: integer("service_fee_cents").notNull(),
  discount_cents: integer("discount_cents").notNull(),
  total_cents: integer("total_cents").notNull(),
  distance_meters: integer("distance_meters").notNull(),
  expires_at: timestamp("expires_at", { withTimezone: true }),
  created_by: varchar("created_by", { length: 36 }).notNull().references(() => adminUsers.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("quotes_order_idx").on(t.order_id)]);

export const orderStatusLogs = pgTable("order_status_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  order_id: varchar("order_id", { length: 36 }).notNull().references(() => orders.id),
  from_status: varchar("from_status", { length: 32 }),
  to_status: varchar("to_status", { length: 32 }).notNull(),
  operator_type: varchar("operator_type", { length: 32 }).notNull(),
  operator_id: varchar("operator_id", { length: 36 }).notNull(),
  remark: text("remark"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("status_logs_order_idx").on(t.order_id)]);

export const payments = pgTable("payments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  order_id: varchar("order_id", { length: 36 }).notNull().references(() => orders.id),
  amount_cents: integer("amount_cents").notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  provider_trade_no: varchar("provider_trade_no", { length: 128 }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("payments_order_idx").on(t.order_id)]);

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  admin_user_id: varchar("admin_user_id", { length: 36 }).notNull().references(() => adminUsers.id),
  action: varchar("action", { length: 64 }).notNull(),
  resource_type: varchar("resource_type", { length: 32 }).notNull(),
  resource_id: varchar("resource_id", { length: 36 }).notNull(),
  detail_json: text("detail_json").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("audit_logs_admin_idx").on(t.admin_user_id)]);

// ─── Vehicle Catalog ───
export const vehicleCatalog = pgTable("vehicle_catalog", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 64 }).notNull(),
  full_name: varchar("full_name", { length: 128 }).notNull(),
  subtitle: varchar("subtitle", { length: 256 }).notNull(),
  description: text("description").notNull(),
  specs_json: text("specs_json").notNull(),
  scenes_json: text("scenes_json").notNull(),
  restrictions_json: text("restrictions_json").notNull(),
  modes_json: text("modes_json").notNull(),
  pricing_hint_json: text("pricing_hint_json").notNull(),
  tags_json: text("tags_json").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  requires_approval: boolean("requires_approval").notNull().default(false),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const vehicleImages = pgTable("vehicle_images", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  vehicle_id: varchar("vehicle_id", { length: 36 }).notNull().references(() => vehicleCatalog.id, { onDelete: 'cascade' }),
  url: text("url").notNull(),
  object_key: varchar("object_key", { length: 256 }).notNull(),
  is_primary: boolean("is_primary").notNull().default(false),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("vehicle_images_vehicle_idx").on(t.vehicle_id)]);

// ─── Content ───
export const contentBanners = pgTable("content_banners", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  image_url: text("image_url").notNull(),
  object_key: varchar("object_key", { length: 256 }).notNull(),
  title: varchar("title", { length: 128 }).notNull(),
  link_type: varchar("link_type", { length: 32 }).notNull(),
  link_target: varchar("link_target", { length: 256 }).notNull(),
  sort_order: integer("sort_order").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Pricing ───
export const pricingRuleVersions = pgTable("pricing_rule_versions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  version: integer("version").notNull().unique(),
  status: varchar("status", { length: 32 }).notNull(),
  config_json: text("config_json").notNull(),
  created_by: varchar("created_by", { length: 36 }).notNull().references(() => adminUsers.id),
  published_by: varchar("published_by", { length: 36 }).references(() => adminUsers.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  published_at: timestamp("published_at", { withTimezone: true }),
});
