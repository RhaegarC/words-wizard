CREATE TABLE `avatar_stages` (
	`avatar_id` text NOT NULL,
	`stage` text NOT NULL,
	`file` text NOT NULL,
	PRIMARY KEY(`avatar_id`, `stage`),
	FOREIGN KEY (`avatar_id`) REFERENCES `avatars`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `avatars` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_zh` text NOT NULL,
	`color` text NOT NULL,
	`pale` text NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `content_meta` (
	`id` integer PRIMARY KEY NOT NULL,
	`schema_version` integer NOT NULL,
	`dataset` text NOT NULL,
	`content_version` text NOT NULL,
	CONSTRAINT "content_meta_id" CHECK("content_meta"."id" = 1),
	CONSTRAINT "content_meta_dataset" CHECK("content_meta"."dataset" IN ('dev', 'final'))
);
--> statement-breakpoint
CREATE TABLE `pack_words` (
	`pack_id` text NOT NULL,
	`word_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`pack_id`, `position`),
	FOREIGN KEY (`pack_id`) REFERENCES `packs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pack_words_position" CHECK("pack_words"."position" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pack_words_pack_word` ON `pack_words` (`pack_id`,`word_id`);--> statement-breakpoint
CREATE INDEX `pack_words_word` ON `pack_words` (`word_id`);--> statement-breakpoint
CREATE TABLE `packs` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`title` text NOT NULL,
	`title_zh` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `packs_topic` ON `packs` (`topic_id`);--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`title_zh` text NOT NULL,
	`icon` text NOT NULL,
	`description` text NOT NULL,
	`description_zh` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE TABLE `words` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`phonetic` text NOT NULL,
	`part_of_speech` text NOT NULL,
	`meaning_en` text NOT NULL,
	`meaning_zh` text NOT NULL,
	`definition_en` text NOT NULL,
	`definition_zh` text NOT NULL,
	`examples` text NOT NULL,
	`image` text,
	`emoji` text,
	`level` integer NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	CONSTRAINT "words_level" CHECK("words"."level" IN (1, 2, 3)),
	CONSTRAINT "words_examples_json" CHECK(json_valid("words"."examples")),
	CONSTRAINT "words_tags_json" CHECK(json_valid("words"."tags"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `words_text_nocase` ON `words` (`text` COLLATE NOCASE);