PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_topic_clusters` (
	`id` text PRIMARY KEY NOT NULL,
	`digest_id` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`why_it_matters` text,
	`suggested_action` text,
	`novelty_level` text,
	`confidence` text,
	`score` real NOT NULL,
	`rank` integer,
	FOREIGN KEY (`digest_id`) REFERENCES `digests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_topic_clusters`("id", "digest_id", "category", "title", "summary", "score") SELECT "id", "digest_id", "category", "title", "summary", "score" FROM `topic_clusters`;--> statement-breakpoint
DROP TABLE `topic_clusters`;--> statement-breakpoint
ALTER TABLE `__new_topic_clusters` RENAME TO `topic_clusters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `topic_clusters_digest_id_idx` ON `topic_clusters` (`digest_id`);