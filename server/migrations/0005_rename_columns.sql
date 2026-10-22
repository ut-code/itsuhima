-- 列名をテーブル名に合わせる (projectId → eventId など)。RENAME COLUMN は行を消さず、
-- インデックスと外部キーの定義の列名も書き換わる。インデックスは名前を付け直すために作り直す
ALTER TABLE `allowedRange` RENAME COLUMN `projectId` TO `eventId`;--> statement-breakpoint
DROP INDEX `AllowedRange_projectId_idx`;--> statement-breakpoint
CREATE INDEX `allowedRange_eventId_idx` ON `allowedRange` (`eventId`);--> statement-breakpoint
ALTER TABLE `option` RENAME COLUMN `projectId` TO `eventId`;--> statement-breakpoint
DROP INDEX `ParticipationOption_projectId_label_key`;--> statement-breakpoint
CREATE UNIQUE INDEX `option_eventId_label_key` ON `option` (`eventId`,`label`);--> statement-breakpoint
ALTER TABLE `slot` RENAME COLUMN `projectId` TO `eventId`;--> statement-breakpoint
ALTER TABLE `slot` RENAME COLUMN `from` TO `startAt`;--> statement-breakpoint
ALTER TABLE `slot` RENAME COLUMN `to` TO `endAt`;--> statement-breakpoint
ALTER TABLE `slot` RENAME COLUMN `participationOptionId` TO `optionId`;--> statement-breakpoint
-- イベントの Slot を時刻順に読むので、eventId だけでなく startAt も含める
DROP INDEX `Slot_projectId_idx`;--> statement-breakpoint
CREATE INDEX `slot_eventId_startAt_idx` ON `slot` (`eventId`,`startAt`);--> statement-breakpoint
DROP INDEX `Slot_guestId_idx`;--> statement-breakpoint
CREATE INDEX `slot_guestId_idx` ON `slot` (`guestId`);--> statement-breakpoint
DROP INDEX `Slot_participationOptionId_idx`;--> statement-breakpoint
CREATE INDEX `slot_optionId_idx` ON `slot` (`optionId`);
