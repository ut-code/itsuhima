// biome-ignore lint/style/noRestrictedImports: このファイルのものを使うための制約
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import "dayjs/locale/ja";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Tokyo");
dayjs.locale("ja");

export default dayjs;
// biome-ignore lint/style/noRestrictedImports: このファイルのものを使うための制約
export type { Dayjs } from "dayjs";
