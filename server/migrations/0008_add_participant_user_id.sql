-- participant は slot から参照されるので、作り直さずに ADD COLUMN で足す (DROP TABLE の暗黙の DELETE で slot が消えるため)。
-- drizzle-kit は ADD COLUMN の外部キーから ON DELETE を落とすので、手で足している。
ALTER TABLE `participant` ADD `userId` text REFERENCES `user`(`id`) ON DELETE set null;--> statement-breakpoint
CREATE UNIQUE INDEX `participant_eventId_userId_key` ON `participant` (`eventId`,`userId`);
