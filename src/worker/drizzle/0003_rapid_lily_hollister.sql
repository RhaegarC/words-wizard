CREATE TABLE `__new_sessions` (
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
	CONSTRAINT "sessions_kind" CHECK("__new_sessions"."kind" IN ('daily', 'monthly', 'free'))
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "user_id", "kind", "local_date", "content_version", "xp_earned", "finished_at", "created_at") SELECT "id", "user_id", "kind", "local_date", "content_version", "xp_earned", "finished_at", "created_at" FROM `sessions`;
--> statement-breakpoint
CREATE TABLE `__old_session_metrics` AS SELECT `user_id`, `session_id`, `name`, `delta` FROM `session_metrics`;
--> statement-breakpoint
DROP TABLE `session_metrics`;
--> statement-breakpoint
DROP TABLE `sessions`;
--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;
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
INSERT INTO `session_metrics`(`user_id`, `session_id`, `name`, `delta`) SELECT `user_id`, `session_id`, `name`, `delta` FROM `__old_session_metrics`;
--> statement-breakpoint
DROP TABLE `__old_session_metrics`;
