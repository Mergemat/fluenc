ALTER TABLE `component_props` ADD `changed_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `palace_actors` ADD `changed_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `palace_sets` ADD `changed_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tone_rooms` ADD `changed_at` integer DEFAULT 0 NOT NULL;