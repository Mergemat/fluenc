CREATE TABLE `component_props` (
	`learner_id` text NOT NULL,
	`component` text NOT NULL,
	`prop_name` text NOT NULL,
	PRIMARY KEY(`learner_id`, `component`),
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `learner_items` (
	`learner_id` text NOT NULL,
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	`due` integer NOT NULL,
	`stability` real DEFAULT 0 NOT NULL,
	`difficulty` real DEFAULT 0 NOT NULL,
	`elapsed_days` integer DEFAULT 0 NOT NULL,
	`scheduled_days` integer DEFAULT 0 NOT NULL,
	`learning_steps` integer DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`state` integer DEFAULT 0 NOT NULL,
	`last_review` integer,
	`introduced_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`learner_id`, `item_type`, `item_id`),
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `learner_items_due_idx` ON `learner_items` (`learner_id`,`due`);--> statement-breakpoint
CREATE TABLE `learners` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT 'Ученик' NOT NULL,
	`daily_character_goal` integer DEFAULT 5 NOT NULL,
	`daily_word_goal` integer DEFAULT 8 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mnemonics` (
	`learner_id` text NOT NULL,
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	`story` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`learner_id`, `item_type`, `item_id`),
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `palace_actors` (
	`learner_id` text NOT NULL,
	`actor_key` text NOT NULL,
	`actor_name` text NOT NULL,
	PRIMARY KEY(`learner_id`, `actor_key`),
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `palace_sets` (
	`learner_id` text NOT NULL,
	`final_key` text NOT NULL,
	`set_name` text NOT NULL,
	PRIMARY KEY(`learner_id`, `final_key`),
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `review_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`learner_id` text NOT NULL,
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	`rating` integer NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`reviewed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `review_logs_learner_date_idx` ON `review_logs` (`learner_id`,`reviewed_at`);--> statement-breakpoint
CREATE TABLE `tone_rooms` (
	`learner_id` text NOT NULL,
	`tone` integer NOT NULL,
	`room_name` text NOT NULL,
	PRIMARY KEY(`learner_id`, `tone`),
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE cascade
);
