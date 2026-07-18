CREATE TABLE `content_banners` (
	`id` text PRIMARY KEY NOT NULL,
	`image_url` text NOT NULL,
	`object_key` text NOT NULL,
	`title` text NOT NULL,
	`link_type` text NOT NULL,
	`link_target` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pricing_rule_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`config_json` text NOT NULL,
	`created_by` text NOT NULL,
	`published_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`published_at` text,
	FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`published_by`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pricing_rule_versions_version_unique` ON `pricing_rule_versions` (`version`);--> statement-breakpoint
CREATE TABLE `vehicle_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`full_name` text NOT NULL,
	`subtitle` text NOT NULL,
	`description` text NOT NULL,
	`specs_json` text NOT NULL,
	`scenes_json` text NOT NULL,
	`restrictions_json` text NOT NULL,
	`modes_json` text NOT NULL,
	`pricing_hint_json` text NOT NULL,
	`tags_json` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`requires_approval` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vehicle_images` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`url` text NOT NULL,
	`object_key` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicle_catalog`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vehicle_images_vehicle_idx` ON `vehicle_images` (`vehicle_id`);