-- browserId をやめて、URL を知っている人が誰でも編集できるモデルにする。
-- 1. 前の一覧を交換するために、browserId ごとに関わったイベントを別表に写す (未回答のホストも)
-- 2. 未回答のホストの行を消す
-- 3. participant を作り直して、role と browserId を外し、name を NOT NULL にする
CREATE TABLE `legacyBrowserEvent` (
	`browserId` text NOT NULL,
	`eventId` text NOT NULL,
	`isHost` integer NOT NULL,
	`participantId` text,
	PRIMARY KEY(`browserId`, `eventId`),
	FOREIGN KEY (`eventId`) REFERENCES `event`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
-- participant は (eventId, browserId) で一意なので、1 行ずつ対応する
INSERT INTO `legacyBrowserEvent` (`browserId`, `eventId`, `isHost`, `participantId`)
SELECT
	`browserId`,
	`eventId`,
	CASE WHEN `role` = 'host' THEN 1 ELSE 0 END,
	CASE WHEN `name` IS NULL THEN NULL ELSE `id` END
FROM `participant`;
--> statement-breakpoint
DELETE FROM `participant` WHERE `name` IS NULL;
--> statement-breakpoint
-- participant は slot から ON DELETE CASCADE で参照されている。DROP TABLE の暗黙の DELETE で slot が消えないよう、
-- 古い participant を RENAME し (slot の外部キーも participant_old を指すように書き換わる)、slot も作り直してから消す
ALTER TABLE `participant` RENAME TO `participant_old`;
--> statement-breakpoint
CREATE TABLE `participant` (
	`id` text PRIMARY KEY NOT NULL,
	`eventId` text NOT NULL,
	`name` text NOT NULL,
	`comment` text,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`eventId`) REFERENCES `event`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `participant` (`id`, `eventId`, `name`, `comment`, `updatedAt`)
SELECT `id`, `eventId`, `name`, `comment`, `updatedAt` FROM `participant_old`;
--> statement-breakpoint
CREATE TABLE `slot_new` (
	`id` text PRIMARY KEY NOT NULL,
	`startAt` text NOT NULL,
	`endAt` text NOT NULL,
	`eventId` text NOT NULL,
	`participantId` text NOT NULL,
	`optionId` text NOT NULL,
	FOREIGN KEY (`eventId`) REFERENCES `event`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`participantId`) REFERENCES `participant`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`optionId`) REFERENCES `option`(`id`) ON UPDATE cascade ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `slot_new` (`id`, `startAt`, `endAt`, `eventId`, `participantId`, `optionId`)
SELECT `id`, `startAt`, `endAt`, `eventId`, `participantId`, `optionId` FROM `slot`;
--> statement-breakpoint
-- slot はどこからも参照されていないので、DROP しても CASCADE で消える行は無い
DROP TABLE `slot`;--> statement-breakpoint
ALTER TABLE `slot_new` RENAME TO `slot`;--> statement-breakpoint
CREATE INDEX `slot_eventId_startAt_idx` ON `slot` (`eventId`,`startAt`);--> statement-breakpoint
CREATE INDEX `slot_participantId_idx` ON `slot` (`participantId`);--> statement-breakpoint
CREATE INDEX `slot_optionId_idx` ON `slot` (`optionId`);--> statement-breakpoint
-- slot を作り直したので、participant_old はどこからも参照されない
DROP TABLE `participant_old`;--> statement-breakpoint
CREATE INDEX `participant_eventId_idx` ON `participant` (`eventId`);
