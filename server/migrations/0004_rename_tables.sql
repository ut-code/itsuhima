-- テーブル名を小文字の単数形・camelCase にする。RENAME は行を消さないので、子のテーブルの行は残り、
-- 子のテーブルの外部キーの参照先も新しい名前に書き換わる
ALTER TABLE `Project` RENAME TO `event`;--> statement-breakpoint
ALTER TABLE `ParticipationOption` RENAME TO `option`;--> statement-breakpoint
-- SQLite のテーブル名は大文字小文字を区別せず、大文字小文字だけ違う名前には直接変えられないので、別の名前を経由する
ALTER TABLE `AllowedRange` RENAME TO `__renaming_allowedRange`;--> statement-breakpoint
ALTER TABLE `__renaming_allowedRange` RENAME TO `allowedRange`;--> statement-breakpoint
ALTER TABLE `Slot` RENAME TO `__renaming_slot`;--> statement-breakpoint
ALTER TABLE `__renaming_slot` RENAME TO `slot`;
