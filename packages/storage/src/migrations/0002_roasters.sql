CREATE TABLE `roasters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`model` text NOT NULL,
	`connection` text,
	`batch_min_g` real NOT NULL,
	`batch_ideal_g` real NOT NULL,
	`batch_max_g` real NOT NULL,
	`max_temp` real NOT NULL,
	`max_time_s` real NOT NULL,
	`temp_offset` real NOT NULL,
	`pid` text NOT NULL,
	`is_active` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `profiles` ADD `roaster_id` integer REFERENCES roasters(id);--> statement-breakpoint
ALTER TABLE `roasts` ADD `roaster_id` integer REFERENCES roasters(id);--> statement-breakpoint
INSERT INTO `roasters` (`id`, `name`, `model`, `connection`, `batch_min_g`, `batch_ideal_g`, `batch_max_g`, `max_temp`, `max_time_s`, `temp_offset`, `pid`, `is_active`) VALUES (1, 'Skywalker', 'skywalker', NULL, 250, 375, 400, 240, 1200, 0, '{"target":{"kp":1.5,"ki":0.02,"kd":0},"targetLimitPct":20,"follow":{"kp":1,"ki":0.01,"kd":0},"preheat":{"kp":5,"ki":0.02,"kd":0},"preheatFanPct":30,"holdS":150,"chargeCutS":5}', 1);--> statement-breakpoint
INSERT INTO `roasters` (`id`, `name`, `model`, `connection`, `batch_min_g`, `batch_ideal_g`, `batch_max_g`, `max_temp`, `max_time_s`, `temp_offset`, `pid`, `is_active`) VALUES (2, 'Simulator', 'simulator', '{"kind":"simulator"}', 250, 375, 400, 240, 1200, 0, '{"target":{"kp":1.5,"ki":0.02,"kd":0},"targetLimitPct":20,"follow":{"kp":1,"ki":0.01,"kd":0},"preheat":{"kp":5,"ki":0.02,"kd":0},"preheatFanPct":30,"holdS":150,"chargeCutS":5}', 0);--> statement-breakpoint
UPDATE `profiles` SET `roaster_id` = 1;--> statement-breakpoint
UPDATE `roasts` SET `roaster_id` = 1;
