CREATE TABLE `sync_events` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_id` text NOT NULL,
	`applied_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE cascade
);
