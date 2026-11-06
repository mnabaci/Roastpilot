ALTER TABLE `roasts` ADD `imported` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Roasts saved without a roaster came from Artisan files (every roast made here has one since 0002).
UPDATE `roasts` SET `imported` = 1 WHERE `roaster_id` IS NULL;
