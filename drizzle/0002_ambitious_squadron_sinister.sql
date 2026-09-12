CREATE TABLE `push_subscriptions` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`last_reminder_day` integer
);
