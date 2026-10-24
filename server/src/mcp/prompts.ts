import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

const argsSchema = z.object({
  event_id: z.string().optional().describe("イベント ID。省略すると list_events で候補を出す。"),
});

/** 手順を指示する user メッセージ */
function userMessage(lines: string[]) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text: lines.join("\n") } }] };
}

/** クライアントの UI から 1 クリックで始められる定型の依頼 */
export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    "submit_availability",
    {
      title: "予定を回答する",
      description: "イツヒマのイベントに、自分の空いている時間帯を回答する。",
      argsSchema,
    },
    ({ event_id }) =>
      userMessage([
        event_id
          ? `イツヒマのイベント ${event_id} に、私の予定を回答したい。`
          : "イツヒマのイベントに、私の予定を回答したい。まず list_events でイベントを一覧して、どれか聞いてほしい。",
        "手順:",
        "1. get_event で、日程の範囲・入力できる時間帯・参加形態の ID・自分の回答を確かめる",
        "2. 私に空いている日時を聞く",
        "3. 相対的な言い方は、get_event が返す現在日時をもとに、オフセット付きの ISO 8601 の絶対日時に直す",
        "4. 回答する内容を私に確かめてから、submit_availability (回答済みなら update_availability) を呼ぶ",
      ]),
  );

  server.registerPrompt(
    "find_best_slot",
    {
      title: "みんなが空いている時間を探す",
      description: "回答を集計して、参加できる人数が多い時間帯を提案する。",
      argsSchema,
    },
    ({ event_id }) =>
      userMessage([
        event_id
          ? `イツヒマのイベント ${event_id} で、みんなが参加できる時間帯を探してほしい。`
          : "イツヒマのイベントで、みんなが参加できる時間帯を探してほしい。まず list_events でイベントを一覧して、どれか聞いてほしい。",
        "find_common_availability で候補を出し、参加できない人がいれば、それが誰かも教えてほしい。",
      ]),
  );
}
