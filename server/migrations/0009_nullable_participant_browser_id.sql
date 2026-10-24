-- participant の持ち主を、ブラウザ (browserId) かユーザー (userId) のどちらか一方にする。
-- browserId を nullable にし、ユーザーの参加者の browserId を null にする。ユーザーを消したら参加者も消す (持ち主のいない参加者を作らない)。
-- あわせて、次の制約とインデックスを足す。
-- - 未回答 (name が null) はホストだけ。ホストはイベントにつき 1 人 (ログインしたときの紐づけが、これを前提にする)
-- - 本人の参加者を browserId・userId だけで引けるよう、一意のインデックスの列の順を入れ替え、eventId のインデックスを足す
--
-- NOT NULL を外すには participant を作り直す必要がある。participant は slot から ON DELETE CASCADE で参照されるので、
-- そのまま DROP TABLE すると暗黙の DELETE で slot が消える。そこで、古い participant を RENAME で退かし
-- (slot の外部キーも退かした方を指すように書き換わる)、新しい participant を参照する slot を作り直してから、古い方を消す。
ALTER TABLE `participant` RENAME TO `__old_participant`;--> statement-breakpoint
DROP INDEX `participant_eventId_browserId_key`;--> statement-breakpoint
DROP INDEX `participant_eventId_userId_key`;--> statement-breakpoint
CREATE TABLE `participant` (
	`id` text PRIMARY KEY NOT NULL,
	`eventId` text NOT NULL,
	`role` text NOT NULL,
	`name` text,
	`comment` text,
	`browserId` text,
	`userId` text,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`eventId`) REFERENCES `event`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "participant_role_check" CHECK("participant"."role" IN ('host', 'guest')),
	CONSTRAINT "participant_owner_check" CHECK(("participant"."browserId" IS NULL) <> ("participant"."userId" IS NULL)),
	CONSTRAINT "participant_answered_check" CHECK("participant"."role" = 'host' OR "participant"."name" IS NOT NULL)
);
--> statement-breakpoint
-- ユーザーに紐づいた参加者は、ユーザーだけのものにする
INSERT INTO `participant` (`id`, `eventId`, `role`, `name`, `comment`, `browserId`, `userId`, `updatedAt`)
SELECT `id`, `eventId`, `role`, `name`, `comment`, CASE WHEN `userId` IS NULL THEN `browserId` END, `userId`, `updatedAt`
FROM `__old_participant`;
--> statement-breakpoint
CREATE INDEX `participant_eventId_idx` ON `participant` (`eventId`);--> statement-breakpoint
CREATE UNIQUE INDEX `participant_browserId_eventId_key` ON `participant` (`browserId`,`eventId`);--> statement-breakpoint
CREATE UNIQUE INDEX `participant_userId_eventId_key` ON `participant` (`userId`,`eventId`);--> statement-breakpoint
CREATE UNIQUE INDEX `participant_eventId_host_key` ON `participant` (`eventId`) WHERE "participant"."role" = 'host';--> statement-breakpoint
-- slot の参照先を新しい participant にする。外部キーは ALTER TABLE で変えられないので作り直す。
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
SELECT `id`, `startAt`, `endAt`, `eventId`, `participantId`, `optionId` FROM `slot`;
--> statement-breakpoint
DROP TABLE `slot`;--> statement-breakpoint
ALTER TABLE `__new_slot` RENAME TO `slot`;--> statement-breakpoint
CREATE INDEX `slot_eventId_startAt_idx` ON `slot` (`eventId`,`startAt`);--> statement-breakpoint
CREATE INDEX `slot_participantId_idx` ON `slot` (`participantId`);--> statement-breakpoint
CREATE INDEX `slot_optionId_idx` ON `slot` (`optionId`);--> statement-breakpoint
-- slot を作り直したので、古い participant はどこからも参照されない
DROP TABLE `__old_participant`;
