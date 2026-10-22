import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { ServiceError } from "../../services/errors.js";
import { getEvent } from "../../services/events.js";
import { type McpContext, missingScope } from "../context.js";
import { sanitize, toolError, toolText, untrustedBlock } from "../format.js";

export const eventIdSchema = z.string().length(21).describe("イベント ID (21 文字)。list_events で取得できる。");

export function registerGetEvent(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "get_event",
    {
      title: "イベントの詳細",
      description:
        "イベントの日程の範囲、入力できる時間帯、参加形態の ID、自分の回答を返す。" +
        "回答 (submit_availability など) の前に呼び、返された ID と時間帯の制約に従うこと。",
      inputSchema: z.object({ event_id: eventIdSchema }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ event_id }) => {
      const scopeError = missingScope(ctx, "read");
      if (scopeError) return toolError(scopeError);

      try {
        const event = await getEvent(ctx.db, ctx.actor, event_id);
        const range = event.allowedRanges[0];
        const facts = [
          "## イベント情報 (システム生成)",
          `event_id: ${event.id}`,
          `URL: ${ctx.origin}/e/${event.id}`,
          `timezone: ${event.timezone}`,
          `日程の範囲: ${event.startDate} 〜 ${event.endDate}`,
          `入力できる時間帯: ${range ? `${range.startTime} 〜 ${range.endTime}` : "終日"} (15 分単位、${event.timezone})`,
          `あなたの立場: ${event.isHost ? "主催者" : event.meAsGuest ? "参加者" : "未参加"}`,
          `回答した人数: ${event.guests.length}`,
          "参加形態 (回答で使う ID):",
          ...event.options.map((o) => `  - id=${o.id} (ラベルは下の untrusted ブロックを参照)`),
          `あなたの回答: ${event.meAsGuest ? `あり (時間帯 ${event.meAsGuest.slots.length} 件)` : "なし"}`,
        ];
        const untrusted = untrustedBlock([
          `event_name: "${sanitize(event.name)}"`,
          `description: "${sanitize(event.description)}"`,
          ...event.options.map((o) => `option[${o.id}] label: "${sanitize(o.label)}"`),
        ]);
        return toolText(`${facts.join("\n")}\n\n${untrusted}`);
      } catch (e) {
        if (e instanceof ServiceError && e.reason === "event_not_found") {
          return toolError("イベントが見つかりません。event_id を確かめるか、list_events で一覧を取得してください。");
        }
        throw e;
      }
    },
  );
}
