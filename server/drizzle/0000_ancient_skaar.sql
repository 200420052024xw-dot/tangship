CREATE TABLE `addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`contact_name` text NOT NULL,
	`phone` text NOT NULL,
	`province` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`district` text DEFAULT '' NOT NULL,
	`poi_name` text DEFAULT '' NOT NULL,
	`formatted_address` text NOT NULL,
	`detail_address` text DEFAULT '' NOT NULL,
	`longitude` real NOT NULL,
	`latitude` real NOT NULL,
	`usage_type` text NOT NULL,
	`is_default_sender` integer DEFAULT false NOT NULL,
	`is_default_receiver` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `addresses_user_idx` ON `addresses` (`user_id`);--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'reviewer' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_username_unique` ON `admin_users` (`username`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_user_id` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`detail_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`role` text NOT NULL,
	`contact_name` text NOT NULL,
	`phone` text NOT NULL,
	`province` text NOT NULL,
	`city` text NOT NULL,
	`district` text NOT NULL,
	`poi_name` text NOT NULL,
	`formatted_address` text NOT NULL,
	`detail_address` text NOT NULL,
	`longitude` real NOT NULL,
	`latitude` real NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_address_role_uq` ON `order_addresses` (`order_id`,`role`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`quantity` integer NOT NULL,
	`estimated_weight_kg` real NOT NULL,
	`length_mm` integer,
	`width_mm` integer,
	`height_mm` integer,
	`fragile` integer DEFAULT false NOT NULL,
	`oversized` integer DEFAULT false NOT NULL,
	`need_carry` integer DEFAULT false NOT NULL,
	`remark` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `order_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`base_fee_cents` integer NOT NULL,
	`distance_fee_cents` integer NOT NULL,
	`vehicle_fee_cents` integer NOT NULL,
	`service_fee_cents` integer NOT NULL,
	`discount_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`distance_meters` integer NOT NULL,
	`expires_at` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `quotes_order_idx` ON `order_quotes` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_status_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`operator_type` text NOT NULL,
	`operator_id` text NOT NULL,
	`remark` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_no` text NOT NULL,
	`user_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`status` text NOT NULL,
	`pickup_type` text NOT NULL,
	`scheduled_at` text,
	`customer_remark` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`rejection_reason` text,
	`idempotency_key` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_no_unique` ON `orders` (`order_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_user_idempotency_uq` ON `orders` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`provider` text NOT NULL,
	`status` text NOT NULL,
	`provider_trade_no` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_sessions_token_hash_unique` ON `user_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`openid` text,
	`nickname` text DEFAULT '' NOT NULL,
	`avatar_url` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openid_unique` ON `users` (`openid`);