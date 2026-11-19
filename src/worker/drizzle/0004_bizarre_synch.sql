CREATE TABLE `exam_attempts` (
	`user_id` text NOT NULL,
	`attempt_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`part_index` integer NOT NULL,
	`passed` integer NOT NULL,
	`missed_word_id` text,
	`at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `attempt_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`oid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`missed_word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "exam_attempt_passed" CHECK("exam_attempts"."passed" IN (0, 1)),
	CONSTRAINT "exam_attempt_part" CHECK("exam_attempts"."part_index" >= 0)
);
--> statement-breakpoint
CREATE INDEX `exam_attempts_topic` ON `exam_attempts` (`user_id`,`topic_id`);--> statement-breakpoint
CREATE TABLE `topic_exam_progress` (
	`user_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`passed_parts` integer NOT NULL,
	`part_count` integer NOT NULL,
	`content_version` text NOT NULL,
	`attempts` integer NOT NULL,
	`last_attempt_at` integer,
	`completed_at` integer,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `topic_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`oid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "topic_exam_passed_parts" CHECK("topic_exam_progress"."passed_parts" >= 0 AND "topic_exam_progress"."passed_parts" <= "topic_exam_progress"."part_count"),
	CONSTRAINT "topic_exam_part_count" CHECK("topic_exam_progress"."part_count" > 0)
);
