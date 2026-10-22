-- 時間帯の時刻を ISO 8601 の日時から、イベントのタイムゾーンでの "HH:mm" にする。
-- 既存のイベントはすべて Asia/Tokyo (0001 で埋めた値) なので、+9 時間で変換する
UPDATE `AllowedRange` SET
  `startTime` = strftime('%H:%M', `startTime`, '+9 hours'),
  `endTime` = strftime('%H:%M', `endTime`, '+9 hours');
