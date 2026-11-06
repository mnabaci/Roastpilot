CREATE TABLE `bean_purchases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bean_id` integer NOT NULL,
	`purchased_at` text NOT NULL,
	`grams` real NOT NULL,
	`batch_plan` text,
	FOREIGN KEY (`bean_id`) REFERENCES `beans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `beans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`origin` text NOT NULL,
	`process` text NOT NULL,
	`variety` text,
	`altitude_m` real,
	`density_g_l` real,
	`moisture_pct` real,
	`screen` real,
	`decaf` integer DEFAULT false NOT NULL,
	`supplier` text,
	`profile_id` text,
	`green_g` real DEFAULT 0 NOT NULL,
	`roasted_g` real DEFAULT 0 NOT NULL,
	`low_stock_g` real DEFAULT 500 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`notes` text
);
--> statement-breakpoint
ALTER TABLE `roasts` ADD `bean_id` integer REFERENCES beans(id);--> statement-breakpoint
ALTER TABLE `roasts` ADD `ghost_roast_id` integer REFERENCES roasts(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `roasts` ADD `batch_g` real;--> statement-breakpoint
ALTER TABLE `roasts` ADD `roasted_g` real;--> statement-breakpoint
ALTER TABLE `roasts` ADD `rating` integer;--> statement-breakpoint
ALTER TABLE `roasts` ADD `is_favourite` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `roasts` ADD `notes` text;