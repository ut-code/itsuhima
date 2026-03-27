// biome-ignore lint/style/noRestrictedImports: このファイルのものを使うための制約
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import "dayjs/locale/ja";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Tokyo"); // itsuhima では時刻x日付のマトリックスを矩形選択するため、座標計算等がタイムゾーンに依存する
dayjs.locale("ja");

export default dayjs;
// biome-ignore lint/style/noRestrictedImports: このファイルのものを使うための制約
export type { Dayjs } from "dayjs";
