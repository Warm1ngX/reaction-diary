CREATE TABLE `reaction_records` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`payload` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
