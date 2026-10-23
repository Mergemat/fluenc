CREATE TABLE `events` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`learner_id` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`received_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_id_unique` ON `events` (`id`);--> statement-breakpoint
CREATE INDEX `events_learner_seq_idx` ON `events` (`learner_id`,`seq`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
ALTER TABLE `component_props` ADD `version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `focus_entries` ADD `removed_at` integer;--> statement-breakpoint
ALTER TABLE `focus_entries` ADD `version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `learner_items` ADD `version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `mnemonics` ADD `version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `palace_actors` ADD `version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `palace_sets` ADD `version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tone_rooms` ADD `version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Keep the review history: past reviews become the first events of their learner.
INSERT INTO `events` (`id`, `learner_id`, `kind`, `data`, `created_at`, `received_at`)
SELECT 'review-log-' || `id`, `learner_id`, 'review',
  json_object('itemType', `item_type`, 'itemId', `item_id`, 'rating', `rating`, 'durationMs', `duration_ms`,
    'reviewedAt', strftime('%Y-%m-%dT%H:%M:%fZ', `reviewed_at` / 1000.0, 'unixepoch')),
  `reviewed_at`, `reviewed_at`
FROM `review_logs` ORDER BY `reviewed_at`, `id`;
