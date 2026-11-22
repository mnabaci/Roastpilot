CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`website` text,
	`email` text,
	`phone` text,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_name` ON `suppliers` (lower("name"));--> statement-breakpoint
ALTER TABLE `beans` ADD `supplier_id` integer REFERENCES suppliers(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `beans_supplier` ON `beans` (`supplier_id`);--> statement-breakpoint
-- Every supplier the beans name becomes one record (docs/spec/data-model.md, Suppliers): names
-- that differ only in case or outer spaces are one, spelled as the oldest bean spelled it.
INSERT INTO `suppliers` (`name`)
SELECT trim(b.`supplier`) FROM `beans` b
WHERE trim(coalesce(b.`supplier`, '')) <> ''
  AND b.`id` = (SELECT min(o.`id`) FROM `beans` o WHERE lower(trim(o.`supplier`)) = lower(trim(b.`supplier`)))
ORDER BY b.`id`;--> statement-breakpoint
UPDATE `beans` SET `supplier_id` = (
  SELECT s.`id` FROM `suppliers` s WHERE lower(s.`name`) = lower(trim(`beans`.`supplier`))
)
WHERE trim(coalesce(`supplier`, '')) <> '';
