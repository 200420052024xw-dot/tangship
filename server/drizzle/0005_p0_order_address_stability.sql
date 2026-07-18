ALTER TABLE `addresses` ADD `migration_key` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `addresses_user_migration_uq` ON `addresses` (`user_id`,`migration_key`);
--> statement-breakpoint
ALTER TABLE `orders` ADD `scheduled_end_at` text;
