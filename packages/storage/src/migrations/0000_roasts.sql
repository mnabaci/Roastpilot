CREATE TABLE `roast_events` (
	`roast_id` integer NOT NULL,
	`t_s` real NOT NULL,
	`type` text NOT NULL,
	`detail` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`roast_id`) REFERENCES `roasts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `roast_events_roast` ON `roast_events` (`roast_id`,`t_s`);--> statement-breakpoint
CREATE TABLE `roast_samples` (
	`roast_id` integer NOT NULL,
	`t_s` real NOT NULL,
	`values` text NOT NULL,
	FOREIGN KEY (`roast_id`) REFERENCES `roasts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `roast_samples_roast` ON `roast_samples` (`roast_id`,`t_s`);--> statement-breakpoint
CREATE TABLE `roasts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mode` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`fc_time_s` real,
	`drop_time_s` real,
	`drop_temp` real
);
--> statement-breakpoint
CREATE INDEX `roasts_started_at` ON `roasts` (`started_at`);