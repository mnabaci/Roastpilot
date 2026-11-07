ALTER TABLE `roasters` ADD `cooler_helps_drum` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- The Skywalker's tray fan sits under the drum (docs/spec/data-model.md, Bean and drum cooling).
UPDATE `roasters` SET `cooler_helps_drum` = 1 WHERE `model` = 'skywalker';
