CREATE TABLE `bean_stock_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bean_id` integer NOT NULL,
	`at` text NOT NULL,
	`kind` text NOT NULL,
	`green_g` real NOT NULL,
	`roasted_g` real NOT NULL,
	`roast_id` integer,
	`note` text,
	FOREIGN KEY (`bean_id`) REFERENCES `beans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`roast_id`) REFERENCES `roasts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `bean_stock_movements_bean` ON `bean_stock_movements` (`bean_id`,`at`);--> statement-breakpoint
CREATE INDEX `bean_stock_movements_roast` ON `bean_stock_movements` (`roast_id`);--> statement-breakpoint
-- Copy the old stock records into the log (docs/spec/data-model.md, Stock log), in the order the
-- history used to list ties: purchases, roasts made here, then adjustments.
INSERT INTO `bean_stock_movements` (`bean_id`, `at`, `kind`, `green_g`, `roasted_g`, `roast_id`, `note`)
SELECT `bean_id`, `purchased_at`, 'bought', `grams`, 0, NULL, NULL FROM `bean_purchases` ORDER BY `id`;--> statement-breakpoint
INSERT INTO `bean_stock_movements` (`bean_id`, `at`, `kind`, `green_g`, `roasted_g`, `roast_id`, `note`)
SELECT `bean_id`, `started_at`, 'roasted', -`batch_g`, coalesce(`roasted_g`, 0), `id`, NULL FROM `roasts`
WHERE `imported` = 0 AND `batch_g` IS NOT NULL AND `bean_id` IN (SELECT `id` FROM `beans`) ORDER BY `id`;--> statement-breakpoint
INSERT INTO `bean_stock_movements` (`bean_id`, `at`, `kind`, `green_g`, `roasted_g`, `roast_id`, `note`)
SELECT `bean_id`, `adjusted_at`,
  CASE `reason` WHEN 'count' THEN 'counted' WHEN 'returned' THEN 'returned' WHEN 'taken' THEN 'taken' ELSE `reason` END,
  `green_g`, `roasted_g`, NULL, `note`
FROM `bean_stock_adjustments` ORDER BY `id`;--> statement-breakpoint
DROP TABLE `bean_purchases`;--> statement-breakpoint
DROP TABLE `bean_stock_adjustments`;--> statement-breakpoint
CREATE INDEX `profiles_roaster` ON `profiles` (`roaster_id`);--> statement-breakpoint
CREATE INDEX `roasts_bean` ON `roasts` (`bean_id`);--> statement-breakpoint
CREATE INDEX `roasts_roaster` ON `roasts` (`roaster_id`);--> statement-breakpoint
CREATE INDEX `roasts_ghost_roast` ON `roasts` (`ghost_roast_id`);