-- Host と Guest を participant にまとめ、role で区別する。name が null なら未回答 (回答していないホスト)。
-- 旧データには更新日時が無いので、マイグレーションを当てた時刻で埋める
CREATE TABLE `participant` (
	`id` text PRIMARY KEY NOT NULL,
	`eventId` text NOT NULL,
	`role` text NOT NULL,
	`name` text,
	`comment` text,
	`browserId` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`eventId`) REFERENCES `event`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "participant_role_check" CHECK("participant"."role" IN ('host', 'guest'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_eventId_browserId_key` ON `participant` (`eventId`,`browserId`);--> statement-breakpoint
-- 回答した人。ホストが自分のイベントに回答していれば、1 行にまとめて role を host にする。
-- id は Guest の id を引き継ぎ、slot の guestId をそのまま participantId にできるようにする
INSERT INTO `participant` (`id`, `eventId`, `role`, `name`, `comment`, `browserId`, `updatedAt`)
SELECT
	g.`id`,
	g.`projectId`,
	CASE WHEN EXISTS (
		SELECT 1 FROM `Host` h WHERE h.`projectId` = g.`projectId` AND h.`browserId` = g.`browserId`
	) THEN 'host' ELSE 'guest' END,
	g.`name`,
	g.`comment`,
	g.`browserId`,
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `Guest` g;
--> statement-breakpoint
-- 回答していないホスト
INSERT INTO `participant` (`id`, `eventId`, `role`, `name`, `comment`, `browserId`, `updatedAt`)
SELECT h.`id`, h.`projectId`, 'host', NULL, NULL, h.`browserId`, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `Host` h
WHERE NOT EXISTS (
	SELECT 1 FROM `Guest` g WHERE g.`projectId` = h.`projectId` AND g.`browserId` = h.`browserId`
);
--> statement-breakpoint
-- slot の参照先を Guest から participant に変える。外部キーは ALTER TABLE で変えられないので作り直す。
-- slot は他のテーブルから参照されないので、DROP しても CASCADE で消える行は無い
CREATE TABLE `__new_slot` (
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
INSERT INTO `__new_slot` (`id`, `startAt`, `endAt`, `eventId`, `participantId`, `optionId`)
SELECT `id`, `startAt`, `endAt`, `eventId`, `guestId`, `optionId` FROM `slot`;
--> statement-breakpoint
DROP TABLE `slot`;--> statement-breakpoint
ALTER TABLE `__new_slot` RENAME TO `slot`;--> statement-breakpoint
CREATE INDEX `slot_eventId_startAt_idx` ON `slot` (`eventId`,`startAt`);--> statement-breakpoint
CREATE INDEX `slot_participantId_idx` ON `slot` (`participantId`);--> statement-breakpoint
CREATE INDEX `slot_optionId_idx` ON `slot` (`optionId`);--> statement-breakpoint
-- Guest を参照していた slot を作り直したので、Guest と Host はどこからも参照されない
DROP TABLE `Guest`;--> statement-breakpoint
DROP TABLE `Host`;
