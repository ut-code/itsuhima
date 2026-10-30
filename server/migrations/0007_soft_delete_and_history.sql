CREATE TABLE `history` (
	`id` text PRIMARY KEY NOT NULL,
	`eventId` text NOT NULL,
	`target` text NOT NULL,
	`targetId` text NOT NULL,
	`action` text NOT NULL,
	`before` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`eventId`) REFERENCES `event`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "history_target_check" CHECK("history"."target" IN ('event', 'participant')),
	CONSTRAINT "history_action_check" CHECK("history"."action" IN ('update', 'delete'))
);
--> statement-breakpoint
CREATE INDEX `history_eventId_createdAt_idx` ON `history` (`eventId`,`createdAt`);--> statement-breakpoint
ALTER TABLE `event` ADD `deletedAt` text;