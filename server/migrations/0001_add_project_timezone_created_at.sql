ALTER TABLE `Project` ADD `timezone` text DEFAULT 'Asia/Tokyo' NOT NULL;--> statement-breakpoint
-- 既定値の無い NOT NULL の列は既存の行があると追加できないので、空文字で追加してから埋める。
-- 旧データには作成日時が無いので、マイグレーションを当てた時刻にする。アプリは常に値を入れる
ALTER TABLE `Project` ADD `createdAt` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `Project` SET `createdAt` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
