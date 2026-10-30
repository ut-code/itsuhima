CREATE TABLE `legacyBrowserEvent` (
	`browserId` text NOT NULL,
	`eventId` text NOT NULL,
	`isHost` integer NOT NULL,
	PRIMARY KEY(`browserId`, `eventId`),
	FOREIGN KEY (`eventId`) REFERENCES `event`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `legacyBrowserEvent_eventId_idx` ON `legacyBrowserEvent` (`eventId`);--> statement-breakpoint
-- 今の participant から写す。(eventId, browserId) は participant で一意なので、1 行ずつ対応する
INSERT INTO `legacyBrowserEvent` (`browserId`, `eventId`, `isHost`)
SELECT `browserId`, `eventId`, `role` = 'host' FROM `participant`;
