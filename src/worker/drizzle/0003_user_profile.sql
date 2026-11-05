ALTER TABLE `users` ADD `email` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `role` text DEFAULT 'user' NOT NULL CONSTRAINT "profiles_role" CHECK(`role` IN ('user', 'teacher', 'admin'));--> statement-breakpoint
ALTER TABLE `profiles` ADD `user_avatar_key` text;
