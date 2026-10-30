CREATE TABLE `metric_events` (
	`user_id` text NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`delta` real NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `event_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`oid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `metrics` (
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`value` real NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `name`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`oid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pack_introductions` (
	`user_id` text NOT NULL,
	`pack_id` text NOT NULL,
	`word_id` text NOT NULL,
	`introduced_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `pack_id`, `word_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`oid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pack_id`) REFERENCES `packs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`character_name` text NOT NULL,
	`avatar` text NOT NULL,
	`current_topic_id` text,
	`xp` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_practice_at` integer NOT NULL,
	`last_wake_at` integer,
	`frozen_days` integer NOT NULL,
	`care_tokens` integer NOT NULL,
	`sessions_since_last_token` integer NOT NULL,
	`completed_sessions` integer NOT NULL,
	`streak_count` integer NOT NULL,
	`best_streak` integer NOT NULL,
	`last_streak_date` text,
	`last_monthly_review_at` integer,
	`locale` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`oid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`current_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "profiles_locale" CHECK("profiles"."locale" IN ('en', 'zh'))
);
--> statement-breakpoint
CREATE TABLE `progress` (
	`user_id` text NOT NULL,
	`word_id` text NOT NULL,
	`status` text NOT NULL,
	`strength` real NOT NULL,
	`next_review_at` integer NOT NULL,
	`correct_count` integer NOT NULL,
	`wrong_count` integer NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`mastery_xp_awarded` integer NOT NULL,
	PRIMARY KEY(`user_id`, `word_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`oid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "progress_status" CHECK("progress"."status" IN ('new', 'learning', 'mastered')),
	CONSTRAINT "progress_strength" CHECK("progress"."strength" >= 0 AND "progress"."strength" <= 1)
);
--> statement-breakpoint
CREATE TABLE `session_metrics` (
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`name` text NOT NULL,
	`delta` real NOT NULL,
	PRIMARY KEY(`user_id`, `session_id`, `name`),
	FOREIGN KEY (`user_id`,`session_id`) REFERENCES `sessions`(`user_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`local_date` text NOT NULL,
	`content_version` text NOT NULL,
	`xp_earned` integer NOT NULL,
	`finished_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`oid`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sessions_kind" CHECK("sessions"."kind" IN ('daily', 'monthly'))
);
--> statement-breakpoint
CREATE TABLE `users` (
	`oid` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
