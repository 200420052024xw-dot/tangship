CREATE TABLE `admin_wechat_bindings` (
  `id` text PRIMARY KEY NOT NULL,
  `admin_user_id` text NOT NULL,
  `user_id` text NOT NULL,
  `granted_by` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `revoked_at` text,
  FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`granted_by`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_wechat_admin_uq` ON `admin_wechat_bindings` (`admin_user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_wechat_user_uq` ON `admin_wechat_bindings` (`user_id`);
