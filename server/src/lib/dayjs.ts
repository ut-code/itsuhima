// biome-ignore lint/style/noRestrictedImports: このファイルのものを使うための制約
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);
dayjs.extend(timezone);
// AllowedRange は UTC の DateTime として保存されるが、意味的には JST の壁時計時刻。
// Slot の日付境界判定も JST 基準で行うため、クライアントと同じ既定タイムゾーンを設定する。
dayjs.tz.setDefault("Asia/Tokyo");

export const APP_TIMEZONE = "Asia/Tokyo";

export default dayjs;
