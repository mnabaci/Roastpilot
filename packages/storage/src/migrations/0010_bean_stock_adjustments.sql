CREATE TABLE `bean_stock_adjustments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bean_id` integer NOT NULL,
	`adjusted_at` text NOT NULL,
	`green_g` real NOT NULL,
	`roasted_g` real NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	FOREIGN KEY (`bean_id`) REFERENCES `beans`(`id`) ON UPDATE no action ON DELETE cascade
);
