CREATE TABLE `digest_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`digest_id` text NOT NULL,
	`category` text NOT NULL,
	`tldr` text NOT NULL,
	`post_count` integer DEFAULT 0 NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`digest_id`) REFERENCES `digests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `digest_sections_digest_id_idx` ON `digest_sections` (`digest_id`);--> statement-breakpoint
CREATE TABLE `digests` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`window_start` integer NOT NULL,
	`window_end` integer NOT NULL,
	`created_at` integer NOT NULL,
	`stats` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `feedback_post_id_idx` ON `feedback` (`post_id`);--> statement-breakpoint
CREATE TABLE `job_openings` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`company` text,
	`role` text NOT NULL,
	`location` text,
	`remote_status` text,
	`seniority` text,
	`experience` text,
	`skills` text NOT NULL,
	`model` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `job_openings_post_id_idx` ON `job_openings` (`post_id`);--> statement-breakpoint
CREATE TABLE `post_analysis` (
	`post_id` text PRIMARY KEY NOT NULL,
	`categories` text NOT NULL,
	`primary_category` text NOT NULL,
	`relevance` real NOT NULL,
	`classifier` text NOT NULL,
	`model` text NOT NULL,
	`processed_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `post_images` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`path` text NOT NULL,
	`ocr_text` text,
	`kept` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_images_post_id_idx` ON `post_images` (`post_id`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`hash` text NOT NULL,
	`url` text,
	`author_name` text NOT NULL,
	`author_headline` text,
	`via_name` text,
	`content` text DEFAULT '' NOT NULL,
	`ocr_text` text,
	`content_type` text DEFAULT 'text' NOT NULL,
	`language` text,
	`published_at` integer,
	`published_at_precision` text,
	`first_seen_run_id` text NOT NULL,
	`last_seen_at` integer NOT NULL,
	`collected_at` integer NOT NULL,
	`processing_status` text DEFAULT 'new' NOT NULL,
	`drop_reason` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`content_purged_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_external_id_unique` ON `posts` (`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `posts_hash_unique` ON `posts` (`hash`);--> statement-breakpoint
CREATE INDEX `posts_processing_status_idx` ON `posts` (`processing_status`);--> statement-breakpoint
CREATE TABLE `run_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `run_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`level` text NOT NULL,
	`stage` text,
	`message` text NOT NULL,
	`data` text,
	`ts` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `run_events_run_id_idx` ON `run_events` (`run_id`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`trigger` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`current_stage` text,
	`started_at` integer,
	`finished_at` integer,
	`stats` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `topic_cluster_posts` (
	`cluster_id` text NOT NULL,
	`post_id` text NOT NULL,
	`rank` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`cluster_id`) REFERENCES `topic_clusters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topic_cluster_posts_pk` ON `topic_cluster_posts` (`cluster_id`,`post_id`);--> statement-breakpoint
CREATE TABLE `topic_clusters` (
	`id` text PRIMARY KEY NOT NULL,
	`digest_id` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`score` real NOT NULL,
	FOREIGN KEY (`digest_id`) REFERENCES `digests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `topic_clusters_digest_id_idx` ON `topic_clusters` (`digest_id`);