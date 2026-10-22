import { z } from "zod";

/** ツールの入力で共通に使うスキーマ */

export const eventIdSchema = z.string().length(21).describe("イベント ID (21 文字)。list_events で取得できる。");

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
