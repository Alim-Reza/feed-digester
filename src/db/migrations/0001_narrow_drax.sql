ALTER TABLE `posts` ADD `is_sponsored` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `is_connection_suggestion` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `is_poll` integer DEFAULT false NOT NULL;