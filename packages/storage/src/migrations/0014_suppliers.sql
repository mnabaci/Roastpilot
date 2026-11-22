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
CREATE INDEX `beans_supplier` ON `beans` (`supplier_id`);
-- Each bean's supplier text becomes a linked record in code, after this file: link-suppliers.ts.
