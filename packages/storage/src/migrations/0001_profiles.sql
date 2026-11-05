CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`doc` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `roasts` ADD `profile` text;