CREATE INDEX `component_props_version_idx` ON `component_props` (`learner_id`,`version`);--> statement-breakpoint
CREATE INDEX `events_learner_item_idx` ON `events` (`learner_id`,json_extract("data", '$.itemId'));--> statement-breakpoint
CREATE INDEX `focus_entries_version_idx` ON `focus_entries` (`learner_id`,`version`);--> statement-breakpoint
CREATE INDEX `learner_items_version_idx` ON `learner_items` (`learner_id`,`version`);--> statement-breakpoint
CREATE INDEX `mnemonics_version_idx` ON `mnemonics` (`learner_id`,`version`);--> statement-breakpoint
CREATE INDEX `palace_actors_version_idx` ON `palace_actors` (`learner_id`,`version`);--> statement-breakpoint
CREATE INDEX `palace_sets_version_idx` ON `palace_sets` (`learner_id`,`version`);--> statement-breakpoint
CREATE INDEX `tone_rooms_version_idx` ON `tone_rooms` (`learner_id`,`version`);