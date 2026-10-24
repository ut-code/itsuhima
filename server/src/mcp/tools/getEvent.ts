import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getEvent } from "../../services/events.js";
import { type McpContext, missingScope } from "../context.js";
import { serviceErrorResult } from "../errors.js";
import { formatEventDetail } from "../eventDetail.js";
import { toolError, toolText } from "../format.js";
import { eventIdSchema } from "../schemas.js";

export function registerGetEvent(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "get_event",
    {
      title: "イベントの詳細",
      description:
        "イベントの日程の範囲、入力できる時間帯、現在日時、参加形態の ID、自分の回答と version、参加できる人数の集計を返す。" +
        "回答 (submit_availability・update_availability) の前に必ず呼び、返された ID・version と時間帯の制約に従うこと。",
      inputSchema: z.object({
        event_id: eventIdSchema,
        include: z
          .enum(["summary", "guests"])
          .default("summary")
          .describe("summary (既定) は集計まで。guests は参加者の名前とコメントも返す (参加者が多いと長くなる)。"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ event_id, include }) => {
      const scopeError = missingScope(ctx, "read");
      if (scopeError) return toolError(scopeError);

      try {
        // Web と同じく、イベント ID を知っていれば読める。ただし非メンバーには集計と参加者を見せない (formatEventDetail)
        const event = await getEvent(ctx.db, ctx.actor, event_id);
        return toolText(formatEventDetail(ctx, event, { includeGuests: include === "guests" }));
      } catch (e) {
        return serviceErrorResult(e);
      }
    },
  );
}
