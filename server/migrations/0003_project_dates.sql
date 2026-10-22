-- 日程を ISO 8601 の日時から、イベントのタイムゾーンでの日付 "YYYY-MM-DD" にする。
-- 既存のイベントはすべて Asia/Tokyo (0001 で埋めた値) なので、+9 時間で変換する。
-- 終了日は "T14:59:59.999Z" (JST のその日の終わり) なので、同じ日になる
UPDATE `Project` SET
  `startDate` = date(`startDate`, '+9 hours'),
  `endDate` = date(`endDate`, '+9 hours');
