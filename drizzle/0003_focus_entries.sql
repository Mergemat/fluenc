CREATE TABLE `focus_entries` (
	`learner_id` text NOT NULL,
	`kind` text NOT NULL,
	`hanzi` text NOT NULL,
	`pinyin` text NOT NULL,
	`meaning` text NOT NULL,
	`label` text NOT NULL,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`learner_id`, `kind`, `hanzi`),
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE cascade
);
