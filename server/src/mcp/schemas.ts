import { z } from "zod";
import { ID_PATTERN } from "../lib/id.js";

/** ツールの入力で共通に使うスキーマ */

/** 日付と時刻を解釈するタイムゾーン (今は全件これ) */
export const EVENT_TIMEZONE = "Asia/Tokyo";

export const eventUrlSchema = z
  .string()
  .min(1)
  .describe(
    "イベントの URL (例: https://itsuhima.utcode.net/e/AbCdEfGhIjKlMnOpQrStU)。URL の末尾のイベント ID (21 文字) だけでもよい。",
  );

const EVENT_URL_PATTERN = /\/e\/([A-Za-z0-9]{21})(?:[/?#]|$)/;

/** イベントの URL (または ID) からイベント ID を取り出す。取り出せなければ null */
export function parseEventId(urlOrId: string): string | null {
  const value = urlOrId.trim();
  if (ID_PATTERN.test(value)) return value;
  return value.match(EVENT_URL_PATTERN)?.[1] ?? null;
}

export const INVALID_EVENT_URL_MESSAGE =
  "イベントの URL の形が正しくありません。https://<ドメイン>/e/<21 文字の ID> の形の URL を、ユーザーに確かめてください。";

export const participantIdSchema = z
  .string()
  .min(1)
  .max(64)
  .describe("回答の ID (participant_id)。get_event が返した値をそのまま使うこと (名前から推測しない)。");

const ISO_DATETIME_NOTE =
  "ISO 8601 の絶対日時で、タイムゾーンのオフセットが必須 (例: 2026-11-02T10:00:00+09:00)。" +
  "「明日」「来週火曜」のような相対表現は受け付けない。get_event が返す現在日時をもとに、絶対日時に直してから渡すこと。";

/**
 * start と end で説明を変えているのは、JSON Schema にしたときに同じスキーマが $ref にまとめられないようにするため
 * ($ref を解決しない MCP クライアントがある)。
 */
const isoDateTimeSchema = (role: string) => z.iso.datetime({ offset: true }).describe(`${role}。${ISO_DATETIME_NOTE}`);

export const rangeSchema = z.object({
  start: isoDateTimeSchema("参加できる時間帯の開始日時"),
  end: isoDateTimeSchema("参加できる時間帯の終了日時"),
  participation_option_id: z
    .string()
    .optional()
    .describe(
      "参加形態の ID。get_event が返した id をそのまま使うこと (ラベルから推測しない)。" +
        "イベントの参加形態が 1 つだけなら省略できる。",
    ),
});

export type RangeInput = z.infer<typeof rangeSchema>;

/** イベントの日付 ("YYYY-MM-DD") */
export const dateSchema = (role: string) =>
  z.iso.date().describe(`${role} (${EVENT_TIMEZONE} の日付、YYYY-MM-DD。例: 2026-11-02)。`);

/** 1 日のうちの時刻 ("HH:mm"、15 分単位。24:00 もありうる) */
export const timeSchema = (role: string, note: string) =>
  z
    .string()
    .regex(/^(([01]\d|2[0-3]):(00|15|30|45)|24:00)$/, "HH:mm で、15 分単位 (:00 / :15 / :30 / :45) で指定してください")
    .describe(`${role} (${EVENT_TIMEZONE} の時刻、HH:mm、15 分単位。${note})。`);

export const nameSchema = z.string().min(1).max(50);
export const commentSchema = z.string().max(500);
