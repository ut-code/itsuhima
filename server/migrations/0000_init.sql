CREATE TABLE `AllowedRange` (
	`id` text PRIMARY KEY NOT NULL,
	`startTime` text NOT NULL,
	`endTime` text NOT NULL,
	`projectId` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `AllowedRange_projectId_idx` ON `AllowedRange` (`projectId`);--> statement-breakpoint
CREATE TABLE `Guest` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`comment` text,
	`browserId` text NOT NULL,
	`projectId` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Guest_browserId_projectId_key` ON `Guest` (`browserId`,`projectId`);--> statement-breakpoint
CREATE INDEX `Guest_projectId_idx` ON `Guest` (`projectId`);--> statement-breakpoint
CREATE TABLE `Host` (
	`id` text PRIMARY KEY NOT NULL,
	`browserId` text NOT NULL,
	`projectId` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Host_browserId_projectId_key` ON `Host` (`browserId`,`projectId`);--> statement-breakpoint
CREATE INDEX `Host_projectId_idx` ON `Host` (`projectId`);--> statement-breakpoint
CREATE TABLE `ParticipationOption` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`color` text NOT NULL,
	`projectId` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ParticipationOption_projectId_label_key` ON `ParticipationOption` (`projectId`,`label`);--> statement-breakpoint
CREATE TABLE `Project` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`startDate` text NOT NULL,
	`endDate` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Slot` (
	`id` text PRIMARY KEY NOT NULL,
	`from` text NOT NULL,
	`to` text NOT NULL,
	`projectId` text NOT NULL,
	`guestId` text NOT NULL,
	`participationOptionId` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON UPDATE cascade ON DELETE no action,
	FOREIGN KEY (`participationOptionId`) REFERENCES `ParticipationOption`(`id`) ON UPDATE cascade ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `Slot_projectId_idx` ON `Slot` (`projectId`);--> statement-breakpoint
CREATE INDEX `Slot_guestId_idx` ON `Slot` (`guestId`);--> statement-breakpoint
CREATE INDEX `Slot_participationOptionId_idx` ON `Slot` (`participationOptionId`);